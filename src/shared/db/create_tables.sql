-- ===============================
--  SENSOR DATA STORAGE SCHEMA
-- ===============================

PRAGMA foreign_keys = ON;

----------------------------------------------------
-- 1. SENSOR DATA (Temperature, pH, Light, etc.)
----------------------------------------------------
CREATE TABLE IF NOT EXISTS sensor_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_name TEXT NOT NULL,
    sensor_type TEXT NOT NULL,
    timestamp REAL NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    upload_status INTEGER DEFAULT 0, -- 0=not synced, 1=synced
    FOREIGN KEY (sensor_type) REFERENCES sensor_types(name)
);

CREATE INDEX IF NOT EXISTS idx_sensor_data_timestamp
    ON sensor_data (timestamp);

----------------------------------------------------
-- 2. SENSOR TYPES (Optional metadata)
----------------------------------------------------
CREATE TABLE IF NOT EXISTS sensor_types (
    name TEXT PRIMARY KEY,
    description TEXT
);

----------------------------------------------------
-- 3. SYSTEM EVENTS / ALERTS
----------------------------------------------------
CREATE TABLE IF NOT EXISTS system_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp REAL NOT NULL,
    event_type TEXT NOT NULL,         -- ERROR, WARNING, INFO, ALERT
    source TEXT NOT NULL,             -- e.g., 'TemperatureSensor', 'MQTTClient'
    message TEXT NOT NULL,
    details TEXT,                     -- Optional JSON blob
    resolved INTEGER DEFAULT 0,       -- 0 = unresolved, 1 = resolved
    upload_status INTEGER DEFAULT 0   -- 0 = not synced, 1 = synced
);

CREATE INDEX IF NOT EXISTS idx_system_events_timestamp
    ON system_events (timestamp);

----------------------------------------------------
-- 4. SYNC LOG (Optional - track cloud syncs)
----------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_count INTEGER NOT NULL,
    timestamp REAL NOT NULL,
    status TEXT NOT NULL              -- 'success', 'failed', etc.
);

