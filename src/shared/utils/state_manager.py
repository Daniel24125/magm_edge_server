# src/edge_server/state_manager.py
import threading
from datetime import datetime
import os 
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.utils.logger import logger


class StateManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if not cls._instance:
            with cls._lock:
                if not cls._instance:  # double-checked locking
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        # Prevent re-initialization every time it's imported
        if self._initialized:
            return
        self.init_mqtt_status()
        self.init_aws_status()
        self.last_sync = None
        self.error_count = 0
        self._initialized = True

    def init_mqtt_status(self):
        # MQTT status related variables
        self.mqtt_connected = False
        self.simulation_mode = False
    
    def init_aws_status(self):
        # AWS status related variables
        self.offline_mode = False
        self.aws_connected = False

    def update_mqtt_status(self, status: bool):
        self.mqtt_connected = status
        logger.state(f"MQTT Connected: {status}")

    def update_aws_status(self, status: bool):
        self.aws_connected = status
        self.offline_mode = not status
        logger.state(f"Connected: {status}")

    def record_error(self):
        self.error_count += 1
        logger.error(f"Error count = {self.error_count}")

    def update_sync(self):
        self.last_sync = datetime.now()
        logger.state(f"Last sync: {self.last_sync}")
