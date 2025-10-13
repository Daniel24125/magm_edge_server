import sqlite3, threading
from pathlib import Path

class LocalDatabase:
    """Thread-safe local SQLite database for sensor data and system logs."""

    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._initialize_schema()

    def _initialize_schema(self):
        """Create all tables if they don't exist."""
        schema_path = Path(__file__).parent / "/db/create_tables.sql"
        with open(schema_path, "r", encoding="utf-8") as f:
            schema_sql = f.read()
        with self._lock, self._conn:
            self._conn.executescript(schema_sql)

    def insert(self, table: str, data: dict):
        """Insert a record into the given table."""
        with self._lock, self._conn:
            columns = ", ".join(data.keys())
            placeholders = ", ".join(["?"] * len(data))
            values = tuple(data.values())
            sql = f"INSERT INTO {table} ({columns}) VALUES ({placeholders})"
            self._conn.execute(sql, values)

    def query(self, sql: str, params: tuple = ()):
        """Run a SELECT query and return list of dicts."""
        with self._lock, self._conn:
            cur = self._conn.execute(sql, params)
            return [dict(row) for row in cur.fetchall()]

    def mark_as_uploaded(self, table: str, ids: list[int]):
        """Mark records as uploaded."""
        if not ids:
            return
        with self._lock, self._conn:
            placeholders = ", ".join("?" * len(ids))
            sql = f"UPDATE {table} SET upload_status = 1 WHERE id IN ({placeholders})"
            self._conn.execute(sql, ids)

    def close(self):
        self._conn.close()
