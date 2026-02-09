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
                    id TEXT PRIMARY KEY,
                    project_id TEXT,
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    status TEXT NOT NULL DEFAULT 'running',
                    session_details TEXT,
                    settings TEXT,
                    alert_configuration TEXT,
                    user_id TEXT,
                    notes TEXT,
                    duration INTEGER,
                    target REAL,
                    synced INTEGER DEFAULT 0,
                    user_email TEXT,
                    is_offline INTEGER DEFAULT 0
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
                    synced INTEGER DEFAULT 0,
                    FOREIGN KEY(session_id) REFERENCES sessions(id)
                        ON UPDATE CASCADE ON DELETE CASCADE,
                    FOREIGN KEY(calibration_id) REFERENCES ph_calibration(id)
                        ON UPDATE CASCADE ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS unified_measurements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    ph REAL,
                    temp REAL,
                    od REAL,
                    co2 REAL,
                    status TEXT,
                    synced INTEGER DEFAULT 0,
                    session_time INTEGER DEFAULT 0,  -- Added for tracking actual session duration
                    FOREIGN KEY(session_id) REFERENCES sessions(id)
                        ON UPDATE CASCADE ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_sessions_status
                    ON sessions(status);

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
                    severity TEXT DEFAULT 'info',
                    acknowledged INTEGER DEFAULT 0,
                    synced INTEGER DEFAULT 0,
                    FOREIGN KEY(session_id) REFERENCES sessions(id)
                        ON UPDATE CASCADE ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_alerts_session
                    ON alerts(session_id);
                """
            )
            
            # Migration for existing tables
            try:
                cur.execute("ALTER TABLE alerts ADD COLUMN severity TEXT DEFAULT 'info'")
            except Exception:
                pass # Column likely exists

            # Migrations for 'synced' column
            try:
                cur.execute("ALTER TABLE sessions ADD COLUMN synced INTEGER DEFAULT 0")
            except Exception:
                pass

            try:
                cur.execute("ALTER TABLE sensor_measurements ADD COLUMN synced INTEGER DEFAULT 0")
            except Exception:
                pass

            try:
                cur.execute("ALTER TABLE alerts ADD COLUMN synced INTEGER DEFAULT 0")
            except Exception:
                pass

            try:
                cur.execute("ALTER TABLE unified_measurements ADD COLUMN synced INTEGER DEFAULT 0")
            except Exception:
                pass

            try:
                cur.execute("ALTER TABLE unified_measurements ADD COLUMN session_time INTEGER DEFAULT 0")
            except Exception:
                pass

            # Offline Support Migrations
            try:
                cur.execute("ALTER TABLE sessions ADD COLUMN user_email TEXT")
            except Exception:
                pass

            try:
                cur.execute("ALTER TABLE sessions ADD COLUMN is_offline INTEGER DEFAULT 0")
            except Exception:
                pass

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
        sensor_id:str,
        device_id:str,
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
                   (sensor_id, device_id, sensor_type, date, slope, intercept, calibration_temp, operator, notes)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (sensor_id, device_id, sensor_type, date_iso, slope, intercept, calibration_temp, operator, notes),
            )
            rid = cur.lastrowid
            self._conn.commit()
            return rid

    def get_last_calibration(
        self, sensor_type: str
    ) -> Optional[Tuple[float, float, float, str, int]]:
        """
        Returns (sensor_id, slope, intercept, calibration_temp, date_iso, id) for the most recent calibration.
        """
        with self._locked_cursor() as cur:
            row = self._retrying_execute(
                cur,
                """SELECT sensor_id, slope, intercept, calibration_temp, date, id
                   FROM ph_calibration
                   WHERE sensor_type = ?
                   ORDER BY date DESC
                   LIMIT 1""",
                (sensor_type,),
            ).fetchone()
            if not row:
                self.insert_calibration( "e6cc7497-d0aa-4cd9-9e56-578b6f9db521","d09454f7-6a4a-44af-9e0d-eb0bea17e9de", "pH", 0.000315967, 2.35586, 25, "Daniel Madalena", "note", datetime.now(timezone.utc).isoformat())
            return row 

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
                   (timestamp, session_id, source, data, processed_value, calibration_id, status, synced)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 0)""",
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
        severity: str = "info",
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
                   (session_id, timestamp, sensor_type, value, message, severity, acknowledged, synced)
                   VALUES (?, ?, ?, ?, ?, ?, 0, 0)""",
                (session_id, timestamp_iso, sensor_type, value, message, severity),
            )
            rid = cur.lastrowid
            self._conn.commit()
            return rid


    def insert_unified_measurement(
        self,
        session_id: str,
        ph: Optional[float] = None,
        temp: Optional[float] = None,
        od: Optional[float] = None,
        co2: Optional[float] = None,
        status: Optional[str] = "OK",
        timestamp_iso: Optional[str] = None,
        session_time: int = 0
    ) -> int:
        """
        Inserts a unified measurement row.
        """
        timestamp_iso = timestamp_iso or utcnow_iso()
        with self._locked_cursor() as cur:
            self._begin_immediate(cur)
            self._retrying_execute(
                cur,
                """INSERT INTO unified_measurements
                   (session_id, timestamp, ph, temp, od, co2, status, synced, session_time)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)""",
                (session_id, timestamp_iso, ph, temp, od, co2, status, session_time),
            )
            rid = cur.lastrowid
            self._conn.commit()
            return rid

    def get_unified_measurements(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Retrieves all unified measurements for a session, ordered by timestamp.
        """
        query = """
            SELECT timestamp, ph, temp, od, co2, status, session_time
            FROM unified_measurements 
            WHERE session_id = ? 
            ORDER BY timestamp ASC
        """
        rows = self.fetch_records_raw(query, (session_id,))
        
        results = []
        for r in rows:
            # Map tuple to dict (order depends on SELECT)
            results.append({
                "timestamp": r[0],
                "ph": r[1],
                "temp": r[2],
                "od": r[3],
                "co2": r[4],
                "status": r[5],
                "session_time": r[6]
            })
        return results

    def get_session_alerts(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Retrieves all alerts for a session, ordered by timestamp.
        """
        query = """
            SELECT timestamp, sensor_type, value, message, severity, acknowledged
            FROM alerts
            WHERE session_id = ?
            ORDER BY timestamp ASC
        """
        rows = self.fetch_records_raw(query, (session_id,))
        
        results = []
        for r in rows:
            results.append({
                "timestamp": r[0],
                "sensor_type": r[1],
                "value": r[2],
                "message": r[3],
                "severity": r[4],
                "acknowledged": r[5]
            })
        return results

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

    # ---------------- Sync Helpers ----------------

    def get_unsynced_sessions(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Retrieves sessions that haven't been synced to Firebase yet.
        """
        rows = self.fetch_records_raw(
            "SELECT id, project_id, start_time, end_time, status, session_details, settings, alert_configuration, user_id, notes, duration, target "
            "FROM sessions WHERE synced = 0 LIMIT ?",
            (limit,)
        )
        results = []
        for r in rows:
            results.append({
                "id": r[0], "project_id": r[1], "start_time": r[2], "end_time": r[3],
                "status": r[4], "session_details": r[5], "settings": r[6],
                "alert_configuration": r[7], "user_id": r[8], "notes": r[9],
                "duration": r[10], "target": r[11]
            })
        return results

    def get_unsynced_measurements(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Retrieves unified measurements that haven't been synced yet.
        """
        rows = self.fetch_records_raw(
            "SELECT id, timestamp, session_id, ph, temp, od, co2, status, session_time "
            "FROM unified_measurements WHERE synced = 0 LIMIT ?",
            (limit,)
        )
        results = []
        for r in rows:
            results.append({
                "id": r[0], "timestamp": r[1], "session_id": r[2], 
                "data": {"ph": r[3], "temp": r[4], "od": r[5], "co2": r[6], "session_time": r[8]}, # Reconstruct data object
                "status": r[7]
            })
        return results

    def mark_session_synced(self, session_id: str) -> None:
        self.update_record("sessions", session_id, {"synced": 1}, id_column="id")

    def mark_measurements_synced(self, ids: List[int]) -> None:
        if not ids:
            return
        if self._conn is None:
            self.connect()
            
        placeholders = ",".join("?" for _ in ids)
        sql = f"UPDATE unified_measurements SET synced = 1 WHERE id IN ({placeholders})"
        
        with self._locked_cursor() as cur:
            self._begin_immediate(cur)
            cur.execute(sql, ids)
            self._conn.commit()

    def get_unsynced_alerts(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Retrieves alerts that haven't been synced yet.
        """
        rows = self.fetch_records_raw(
            "SELECT id, session_id, timestamp, sensor_type, value, message, severity, acknowledged "
            "FROM alerts WHERE synced = 0 LIMIT ?",
            (limit,)
        )
        results = []
        for r in rows:
            results.append({
                "id": r[0], "session_id": r[1], "timestamp": r[2], 
                "sensor_type": r[3], "value": r[4], "message": r[5], 
                "severity": r[6], "acknowledged": r[7]
            })
        return results

    def mark_alerts_synced(self, ids: List[int]):
        """
        Marks alerts as synced.
        """
        if not ids:
            return

        if self._conn is None:
            self.connect()
            
        placeholders = ",".join("?" for _ in ids)
        sql = f"UPDATE alerts SET synced = 1 WHERE id IN ({placeholders})"
        
        with self._locked_cursor() as cur:
            self._begin_immediate(cur)
            cur.execute(sql, ids)
            self._conn.commit()

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
        q = "SELECT id FROM sessions"
        if active_only:
            q += " WHERE status = 'running'"
        q += " ORDER BY start_time DESC LIMIT 1"
        rows = self.db.fetch_records_raw(q)
        return rows[0][0] if rows else None

    def list_recent_sessions(self, limit: int = 10) -> List[Tuple]:
        return self.db.fetch_records_raw(
            "SELECT id, start_time, end_time, status, user_id "
            "FROM sessions ORDER BY start_time DESC LIMIT ?",
            (limit,),
        )

    def get_session(self, id: str, field: str) -> Any:
        # Validate field to prevent SQL injection (basic check)
        valid_fields = ["id", "project_id", "start_time", "end_time", "status", "user_id", "notes", "duration", "target"]
        if field not in valid_fields:
            logger.warning(f"Attempted to access invalid session field: {field}")
            return None
            
        row = self.db.fetch_records_raw(
            f"SELECT {field} FROM sessions WHERE id = ?",
            (id,)
        )
        return row[0][0] if row else None


