import json
import os
import sys
from typing import Dict, Optional, Any

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger
from shared.utils.config_loader import load_config

class AnomalyDetector:
    def __init__(self, config_path: str):
        self.rules = self._load_rules(config_path)

    def _load_rules(self, path: str) -> Dict[str, Any]:
        try:
            return load_config(path)
        except Exception as e:
            logger.error(f"Failed to load anomaly rules from {path}: {e}")
            return {}

    def check_reading(self, sensor_type: str, value: float) -> Optional[str]:
        """
        Checks a reading against the rules.
        Returns an alert message if an anomaly is detected, otherwise None.
        """
        rule = self.rules.get(sensor_type)
        if not rule:
            return None

        min_val = rule.get("min")
        max_val = rule.get("max")

        if min_val is not None and value < min_val:
            return f"{sensor_type} value {value:.2f} is below minimum threshold {min_val}"
        
        if max_val is not None and value > max_val:
            return f"{sensor_type} value {value:.2f} is above maximum threshold {max_val}"

        return None
