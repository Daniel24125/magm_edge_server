# db_manager.py
from __future__ import annotations

import sqlite3
import threading
import time, os, sys
from contextlib import contextmanager
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

# --- Use the project's logger if available; otherwise fall back gracefully
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger

def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DatabaseHelper:
    """
    Thread-safe SQLite helper for the edge server.
    Responsibilities:
      - Ensure schema exists
      - Provide CRUD helpers and domain inserts (calibration, measurements)
      - Be resilient to transient 'database is locked' states
    Non-responsibilities:
      - Session lifecycle (start/stop) – handled by SessionController
    """

    def __init__(self, db_path: Path | str):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = None
        self.db_init()
        self._create_schema()
        logger.info("SQLite ready at %s", self.db_path.as_posix())
    
        

    def db_init(self):
        # One shared connection per process; protect with an RLock
        self.connect()
        # Pragmas tuned for Raspberry Pi edge workloads
        self._conn.execute("PRAGMA foreign_keys = ON;")
        self._conn.execute("PRAGMA journal_mode = WAL;")
        self._conn.execute("PRAGMA synchronous = NORMAL;")
        self._conn.execute("PRAGMA busy_timeout = 8000;")
        self._lock = threading.RLock()
        self.connected = True

    def connect(self): 
        if self._conn is None:
            self._conn = sqlite3.connect(
            self.db_path.as_posix(),
            check_same_thread=False,     # allow access from multiple threads (we lock manually)
            isolation_level=None,        # autocommit; we explicitly BEGIN IMMEDIATE when needed
            timeout=5.0,
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
    # ---------------- Schema ----------------

    def _create_schema(self) -> None:
        with self._locked_cursor() as cur:
            cur.executescript(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    project_id TEXT,
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    active INTEGER NOT NULL DEFAULT 1,
                    user TEXT,
                    notes TEXT
                );

                CREATE TABLE IF NOT EXISTS ph_calibration (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sensor_id TEXT NOT NULL,
                    device_id TEXT NOT NULL,
                    sensor_type TEXT NOT NULL,        -- e.g., 'pH'
                    date TEXT NOT NULL,               -- ISO UTC
                    slope REAL NOT NULL,
                    intercept REAL NOT NULL,
                    calibration_temp REAL NOT NULL,   -- °C
                    operator TEXT,
                    notes TEXT
                );

                CREATE TABLE IF NOT EXISTS sensor_measurements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,          -- ISO UTC
                    session_id TEXT NOT NULL,
                    source TEXT NOT NULL,        -- e.g., 'rpi', 'nir'
                    data TEXT NOT NULL,
                    processed_value REAL,
                    calibration_id INTEGER,
                    status TEXT,                      -- 'OK','OUT_OF_RANGE','ERROR',...
                    FOREIGN KEY(session_id) REFERENCES sessions(session_id)
                        ON UPDATE CASCADE ON DELETE CASCADE,
                    FOREIGN KEY(calibration_id) REFERENCES ph_calibration(id)
                        ON UPDATE CASCADE ON DELETE SET NULL
                );

                CREATE INDEX IF NOT EXISTS idx_sessions_active
                    ON sessions(active);

                CREATE INDEX IF NOT EXISTS idx_meas_time_sensor
                    ON sensor_measurements(session_id, timestamp);

                CREATE INDEX IF NOT EXISTS idx_meas_session
                    ON sensor_measurements(session_id);

                CREATE INDEX IF NOT EXISTS idx_calib_date
                    ON ph_calibration(date);

                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    sensor_type TEXT NOT NULL,
                    value REAL NOT NULL,
                    message TEXT NOT NULL,
                    acknowledged INTEGER DEFAULT 0,
                    FOREIGN KEY(session_id) REFERENCES sessions(session_id)
                        ON UPDATE CASCADE ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_alerts_session
                    ON alerts(session_id);

                CREATE TABLE IF NOT EXISTS projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sessions TEXT NOT NULL,
                    reactor_name TEXT NOT NULL,
                    project_type TEXT NOT NULL, -- e.g., 'manual', 'timer', 'target' ...
                    project_name TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    session_parameters TEXT NOT NULL, -- 'co2_pressure','medium_composition','data_aquisition_frequency', 'temperature_setpoint', 'ph_setpoint', ... 
                    user TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_projects
                    ON projects(project_name, user, id);
                """
            )
        # Major op: table creation/ensure
        logger.info("Database initialized and tables ensured")

    # ---------------- Low-level helpers ----------------

    @contextmanager
    def _locked_cursor(self):
        with self._lock:
            cur = self._conn.cursor()
            try:
                yield cur
            finally:
                cur.close()

    def _begin_immediate(self, cur: sqlite3.Cursor) -> None:
        if not self._conn.in_transaction:
            cur.execute("BEGIN IMMEDIATE;")

    def _retrying_execute(
        self,
        cur: sqlite3.Cursor,
        query: str,
        params: Iterable = (),
        max_retries: int = 3,
        pause: float = 0.15,
    ):
        attempt = 0
        while True:
            try:
                return cur.execute(query, params)
            except sqlite3.OperationalError as e:
                msg = str(e).lower()
                if ("locked" in msg or "busy" in msg) and attempt < max_retries:
                    logger.warning("SQLite busy/locked, retrying (%d/%d)...", attempt + 1, max_retries)
                    time.sleep(pause * (attempt + 1))
                    attempt += 1
                    continue
                logger.error("SQLite OperationalError on '%s' params=%s: %s", query, params, e)
                raise

    # ---------------- Domain methods ----------------

    def insert_calibration(
        self,
        sensor_type: str,
        slope: float,
        intercept: float,
        calibration_temp: float,
        operator: Optional[str] = None,
        notes: Optional[str] = None,
        date_iso: Optional[str] = None,
    ) -> int:
        """
        Returns the inserted calibration row id.
        """
        date_iso = date_iso or utcnow_iso()
        with self._locked_cursor() as cur:
            self._begin_immediate(cur)
            self._retrying_execute(
                cur,
                """INSERT INTO ph_calibration
                   (sensor_type, date, slope, intercept, calibration_temp, operator, notes)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (sensor_type, date_iso, slope, intercept, calibration_temp, operator, notes),
            )
            rid = cur.lastrowid
            self._conn.commit()
            return rid

    def get_last_calibration(
        self, sensor_type: str
    ) -> Optional[Tuple[float, float, float, str, int]]:
        """
        Returns (slope, intercept, calibration_temp, date_iso, id) for the most recent calibration.
        """
        with self._locked_cursor() as cur:
            row = self._retrying_execute(
                cur,
                """SELECT slope, intercept, calibration_temp, date, id
                   FROM ph_calibration
                   WHERE sensor_type = ?
                   ORDER BY date DESC
                   LIMIT 1""",
                (sensor_type,),
            ).fetchone()
            return row if row else None

    def insert_measurement(
        self,
        session_id: str,
        source: str,
        data: str,
        processed_value: Optional[float] = None,
        calibration_id: Optional[int] = None,
        status: Optional[str] = "OK",
        timestamp_iso: Optional[str] = None,
    ) -> int:
        """
        Returns the inserted measurement row id.
        """
        timestamp_iso = timestamp_iso or utcnow_iso()
        with self._locked_cursor() as cur:
            self._begin_immediate(cur)
            self._retrying_execute(
                cur,
                """INSERT INTO sensor_measurements
                   (timestamp, session_id, source, data, processed_value, calibration_id, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (timestamp_iso, session_id, source, data, processed_value, calibration_id, status),
            )
            rid = cur.lastrowid
            self._conn.commit()
            return rid

    def insert_alert(
        self,
        session_id: str,
        sensor_type: str,
        value: float,
        message: str,
        timestamp_iso: Optional[str] = None,
    ) -> int:
        """
        Returns the inserted alert row id.
        """
        timestamp_iso = timestamp_iso or utcnow_iso()
        with self._locked_cursor() as cur:
            self._begin_immediate(cur)
            self._retrying_execute(
                cur,
                """INSERT INTO alerts
                   (timestamp, session_id, sensor_type, value, message)
                   VALUES (?, ?, ?, ?, ?)""",
                (timestamp_iso, session_id, sensor_type, value, message),
            )
            rid = cur.lastrowid
            self._conn.commit()
            return rid

    # ---------------- Generic CRUD ----------------

    def add_record(self, table: str, data: Dict[str, Any]) -> int:
        if self._conn is None: 
            self.connect()
        keys = ", ".join(data.keys())
        placeholders = ", ".join("?" for _ in data)
        sql = f"INSERT INTO {table} ({keys}) VALUES ({placeholders})"
        with self._locked_cursor() as cur:
            self._begin_immediate(cur)
            self._retrying_execute(cur, sql, tuple(data.values()))
            rid = cur.lastrowid
            self._conn.commit()
            return rid

    def update_record(self, table: str, record_id: Any, data: Dict[str, Any], id_column: str = "id") -> None:
        if self._conn is None: 
            self.connect()
        sets = ", ".join(f"{k}=?" for k in data.keys())
        sql = f"UPDATE {table} SET {sets} WHERE {id_column}=?"
        params = list(data.values()) + [record_id]
        with self._locked_cursor() as cur:
            self._begin_immediate(cur)
            self._retrying_execute(cur, sql, params)
            self._conn.commit()

    def delete_record(self, table: str, record_id: Any, id_column: str = "id") -> None:
        if self._conn is None: 
            self.connect()
        with self._locked_cursor() as cur:
            self._begin_immediate(cur)
            self._retrying_execute(cur, f"DELETE FROM {table} WHERE {id_column}=?", (record_id,))
            self._conn.commit()

    def fetch_records(self, table: str, where: Optional[str] = None, params: Iterable = ()) -> List[Tuple]:
        if self._conn is None: 
            self.connect()
        sql = f"SELECT * FROM {table}"
        if where:
            sql += f" WHERE {where}"
        with self._locked_cursor() as cur:
            rows = self._retrying_execute(cur, sql, params).fetchall()
            return rows

    # Raw query helper (read-only)
    def fetch_records_raw(self, query: str, params: Iterable = ()) -> List[Tuple]:
        if self._conn is None: 
            self.connect()
        with self._locked_cursor() as cur:
            rows = self._retrying_execute(cur, query, params).fetchall()
            return rows

    # ---------------- Cleanup ----------------

    def close(self) -> None:
        with self._lock:
            try:
                self._conn.close()
                self._conn = None
            except Exception as e:  # pragma: no cover
                logger.warning("Error closing DB: %s", e)


# ---------------- Optional: Read-only Session DAO ----------------

class SessionDAO:
    """
    Thin, read-only access layer for sessions to be used by SessionController.
    Keeps DatabaseHelper pure of lifecycle logic while still providing convenient queries.
    """
    def __init__(self, db: DatabaseHelper):
        self.db = db

    def get_last_session_id(self, active_only: bool = True) -> Optional[str]:
        q = "SELECT session_id FROM sessions"
        if active_only:
            q += " WHERE active = 1"
        q += " ORDER BY start_time DESC LIMIT 1"
        rows = self.db.fetch_records_raw(q)
        return rows[0][0] if rows else None

    def list_recent_sessions(self, limit: int = 10) -> List[Tuple]:
        return self.db.fetch_records_raw(
            "SELECT session_id, start_time, end_time, active, user "
            "FROM sessions ORDER BY start_time DESC LIMIT ?",
            (limit,),
        )
