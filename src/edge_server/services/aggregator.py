
import threading
import time
import json
from datetime import datetime
from typing import Dict, Any, Optional

from shared.utils.logger import logger
from database.db_manager import DatabaseHelper

class DataAggregator:
    def __init__(self, db: DatabaseHelper, timeout: int = 15, on_complete_callback=None):
        self.db = db
        self.timeout = timeout
        self.on_complete_callback = on_complete_callback
        self.current_collection: Optional[Dict[str, Any]] = None
        self.collection_lock = threading.Lock()
        self.timer: Optional[threading.Timer] = None
        self.session_id: Optional[str] = None
        self.pending_timestamp: Optional[str] = None
        self.expected_sources: set = set()
        self.received_sources: set = set()
        self.save_to_db: bool = True
    
    def start_collection(self, session_id: str, timestamp_iso: str, expected_sources: set, save_to_db: bool = True):
        """
        Starts a new data collection window. 
        If a previous window is active, it force-closes it.
        expected_sources: Set of device IDs (sources) to wait for.
        save_to_db: Whether to save the result to the database (True) or just publish (False).
        """
        with self.collection_lock:
            # If there's an active collection, finalize it immediately (it's incomplete)
            if self.current_collection is not None:
                logger.warning("Starting new collection while previous one is still active. Force saving.")
                self._finalize_collection()
                if self.timer:
                    self.timer.cancel()

            self.session_id = session_id
            self.pending_timestamp = timestamp_iso
            self.current_collection = {} # Reset collection
            self.expected_sources = expected_sources
            self.received_sources = set()
            self.save_to_db = save_to_db
            
            # Start timeout timer
            self.timer = threading.Timer(self.timeout, self._on_timeout)
            self.timer.start()
            logger.info(f"Started data aggregation for session {session_id} at {timestamp_iso} with sources {expected_sources} (save_to_db={save_to_db})")

    def add_reading(self, source: str, data: Dict[str, Any]):
        """
        Adds a reading from a specific source (e.g., 'rpi', 'nir').
        """
        with self.collection_lock:
            if self.current_collection is None:
                logger.warning(f"Received data from {source} but no collection is active. Ignoring.")
                return

            if source not in self.expected_sources:
                 logger.warning(f"Received data from unexpected source {source}. Ignoring.")
                 return

            # Merge data into current collection
            flat_data = self._flatten_reading(data)
            self.current_collection.update(flat_data)
            self.received_sources.add(source)
            logger.info(f"Added reading from {source}: {flat_data}")
            
            self._check_complete()

    def _flatten_reading(self, data: Dict[str, Any]) -> Dict[str, float]:
        """
        Helper to flatten sensor readings.
        Input: {"ph": {"value": 7.0, ...}, "temp": ...} OR {"ph": 7.0}
        Output: {"ph": 7.0, ...}
        """
        result = {}
        for key, val in data.items():
            if isinstance(val, dict) and 'value' in val:
                try:
                    result[key] = float(val['value'])
                except (ValueError, TypeError):
                    logger.warning(f"Could not parse value for {key}: {val}")
            
            elif isinstance(val, (int, float)):
                 result[key] = float(val)
            else:
                 # Try to cast
                 try:
                     result[key] = float(val)
                 except:
                     pass
        return result

    def _check_complete(self):
        """
        Checks if we have all expected data points from sources.
        """
        if self.expected_sources.issubset(self.received_sources):
            logger.info("All expected measurements received. Finalizing.")
            self._finalize_collection()
            if self.timer:
                self.timer.cancel()
                self.timer = None

    def _on_timeout(self):
        with self.collection_lock:
            if self.current_collection is not None:
                logger.warning("Data aggregation timed out. Saving partial data.")
                self._finalize_collection(status="TIMEOUT")
            self.timer = None

    def _finalize_collection(self, status="OK"):
        """
        Saves the current collection to the DB and clears state.
        """
        if not self.session_id or self.current_collection is None:
            return

        try:
            if self.save_to_db:
                self.db.insert_unified_measurement(
                    session_id=self.session_id,
                    timestamp_iso=self.pending_timestamp,
                    ph=self.current_collection.get('ph'),
                    temp=self.current_collection.get('temp'),
                    od=self.current_collection.get('od'),
                    co2=self.current_collection.get('co2'),
                    status=status
                )
                logger.info(f"Saved unified measurement. Status: {status}")
            else:
                logger.info(f"Live measurement complete (not saved). Status: {status}")
            
            if self.on_complete_callback:
                self.on_complete_callback({
                    "session_id": self.session_id,
                    "timestamp": self.pending_timestamp,
                    "data": self.current_collection,
                    "status": status,
                    "is_recorded": self.save_to_db
                })

        except Exception as e:
            logger.error(f"Failed to save unified measurement: {e}")
        finally:
            self.current_collection = None
            self.pending_timestamp = None
            # Do NOT clear session_id as it serves next request? No, start_collection sets it.
