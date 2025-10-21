# src/edge_server/state_manager.py
import threading
from datetime import datetime
import os 
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.utils.logger import logger
from shared.utils.config_loader import load_config, save_config

class ConfigManager:
    _instance = None
    _lock = threading.Lock()
    _config = load_config(os.path.join(os.path.dirname(__file__), "sensors.json"))

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
        

    def get_config(self) -> dict:
        """
        Load configuration from a JSON file.

        Returns:
            dict: The loaded configuration.
        """
        return self._config

    def update_config(self, new_config: dict):
        """
        Update the current configuration and save it to the JSON file.

        Args:
            new_config (dict): The new configuration to be saved.
        """
        self._config.update(new_config)
        save_config(os.path.join(os.path.dirname(__file__), "sensors.json"), self._config)
        logger.info("Configuration updated and saved.")
        logger.info(f"New config: {self._config}")