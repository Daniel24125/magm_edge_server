
import threading
import time
import json
from datetime import datetime
from typing import Dict, Any, Optional, Set, List

from shared.utils.logger import logger
from database.db_manager import DatabaseHelper

class DataAggregator:
    def __init__(self, db: DatabaseHelper, timeout: int = 15, on_complete_callback=None):
        self.db = db
        self.timeout = timeout
        self.on_complete_callback = on_complete_callback
        
        # State
        self.current_collection: Optional[Dict[str, Any]] = None
        self.collection_lock = threading.Lock()
        self.timer: Optional[threading.Timer] = None
        self.session_id: Optional[str] = None
        self.pending_timestamp: Optional[str] = None
        self.expected_sources: Set[str] = set()
        self.received_sources: Set[str] = set()
        self.save_to_db: bool = True
    
    # -------------------- Public API --------------------

    def start_collection(self, session_id: str, timestamp_iso: str, expected_sources: Set[str], save_to_db: bool = True, session_time: int = 0):
        """
        Starts a new data collection window. 
        Force-closes previous window if active.
        """
        with self.collection_lock:
            if self.current_collection is not None:
                logger.warning("Starting new collection while previous one is still active. Force saving.")
                self._finalize_collection()
                self._stop_timer()

            self._reset_state(session_id, timestamp_iso, expected_sources, save_to_db, session_time)
            logger.debug(f"Aggregator started: expected={self.expected_sources}")
            self._start_timer()
            

    def add_reading(self, source: str, data: Dict[str, Any]):
        """
        Adds a reading from a specific source.
        """
        with self.collection_lock:
            if not self._validate_reading(source):
                return

            flat_data = self._flatten_reading(data)
            self.current_collection.update(flat_data)
            self.received_sources.add(source)
            logger.debug(f"Added reading from {source}: {flat_data}")
            
            self._check_complete()

    # -------------------- Internal Logic --------------------

    def _reset_state(self, session_id, timestamp, expected_sources, save_to_db, session_time):
        self.session_id = session_id
        self.pending_timestamp = timestamp
        self.current_collection = {} 
        self.expected_sources = expected_sources
        self.received_sources = set()
        self.save_to_db = save_to_db
        self.session_time = session_time

    def _start_timer(self):
        self.timer = threading.Timer(self.timeout, self._on_timeout)
        self.timer.start()

    def _stop_timer(self):
        if self.timer:
            self.timer.cancel()
            self.timer = None

    def _validate_reading(self, source: str) -> bool:
        if self.current_collection is None:
            logger.warning(f"Ignored data from {source}: No active collection.")
            return False
        if source not in self.expected_sources:
            logger.warning(f"Ignored data from {source}: Unexpected source.")
            return False
        return True

    def _flatten_reading(self, data: Dict[str, Any]) -> Dict[str, float]:
        """
        Flattens sensor readings to simple key-value pairs.
        Handles nested {"value": x} format.
        """
        result = {}
        ignored_keys = {'spectra', 'wavelengths', 'wavelength', 'id', 'source', 'type'}
        
        for key, val in data.items():
            if key in ignored_keys:
                continue
                
            parsed_val = self._parse_value(val)
            if parsed_val is not None:
                result[key] = parsed_val
            else:
                # Log debug instead of warning to reduce noise for unparsable types
                logger.debug(f"Skipping unparsable value for {key}: {type(val)}")
        return result

    def _parse_value(self, val: Any) -> Optional[float]:
        try:
            if isinstance(val, dict) and 'value' in val:
                return float(val['value'])
            elif isinstance(val, (int, float)):
                return float(val)
            else:
                return float(val) # Try casting string/other
        except (ValueError, TypeError):
             return None

    def _check_complete(self):
        if self.expected_sources.issubset(self.received_sources):
            self._finalize_collection()
            self._stop_timer()

    def _on_timeout(self):
        """
        Called when the timer expires. Finishes collection with partial data.
        """
        with self.collection_lock:
            if self.current_collection is not None:
                logger.warning("Aggregation timed out. Saving partial data.")
                # Check if DB is still available (to avoid crash during shutdown)
                if self.db and hasattr(self.db, '_conn') and self.db._conn:
                    self._finalize_collection(status="timeout")
                else:
                    logger.warning("DB unavailable during timeout, skipping partial save.")
                    self.current_collection = None
                    self.pending_timestamp = None
            self.timer = None

    def _finalize_collection(self, status="OK"):
        """Save to DB and notify callback."""
        if not self.session_id or self.current_collection is None:
            return

        try:
            if self.save_to_db:
                self._save_to_database(status)
            
            if self.on_complete_callback:
                self._notify_callback(status)

        except Exception as e:
            logger.error(f"Failed to finalize collection: {e}")
        finally:
            self.current_collection = None
            self.pending_timestamp = None

    def _save_to_database(self, status):
        self.db.insert_unified_measurement(
            session_id=self.session_id,
            timestamp_iso=self.pending_timestamp,
            ph=self.current_collection.get('ph'),
            temp=self.current_collection.get('temp'),
            od=self.current_collection.get('od'),
            co2=self.current_collection.get('co2'),
            status=status,
            session_time=getattr(self, 'session_time', 0)
        )
        logger.info(f"Saved measurement. Status: {status}")

    def _notify_callback(self, status):
        self.on_complete_callback({
            "session_id": self.session_id,
            "timestamp": self.pending_timestamp,
            "data": self.current_collection,
            "status": status,
            "is_recorded": self.save_to_db,
            "session_time": getattr(self, 'session_time', 0)
        })
