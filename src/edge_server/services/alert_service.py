from typing import Optional, Any
from datetime import datetime, timezone
from shared.utils.logger import logger

class AlertManager:
    """
    Centralized service for handling system and session alerts.
    ensures consistency between database persistence and frontend notifications.
    """
    def __init__(self, db_helper: Any, client: Any):
        self.db = db_helper
        self.client = client
        # Track last alert times: Key = "session_id:sensor_type", Value = timestamp (float)
        self._last_alert_times = {}

    def send_session_alert(self, 
                           session_id: str, 
                           device_id: str, 
                           sensor_type: str, 
                           value: float, 
                           message: str,
                           severity: str = "warning",
                           timestamp: Optional[str] = None,
                           cooldown_seconds: int = 60):
        """
        Handles a session-specific alert (e.g. sensor anomaly).
        1. Checks cooldown to prevent flooding.
        2. Saves to Database (alerts table).
        3. Publishes to 'session/alerts'.
        """
        
        # Check cooldown
        alert_key = f"{session_id}:{sensor_type}"
        now_ts = datetime.now(timezone.utc).timestamp()
        last_ts = self._last_alert_times.get(alert_key, 0)
        
        if (now_ts - last_ts) < cooldown_seconds:
            # logger.debug(f"Alert suppressed for {alert_key} due to cooldown.")
            return

        self._last_alert_times[alert_key] = now_ts

        if timestamp is None:
            timestamp = datetime.now(timezone.utc).isoformat()

        # 1. Persist
        try:
            self.db.insert_alert(
                session_id=session_id,
                sensor_type=sensor_type,
                value=value,
                message=message,
                severity=severity,
                timestamp_iso=timestamp
            )
        except Exception as e:
            logger.error(f"Failed to insert session alert into DB: {e}")

        # 2. Publish
        try:
            payload = {
                "id": session_id,
                "device_id": device_id,
                "sensor_type": sensor_type,
                "value": value,
                "message": message,
                "severity": severity,
                "timestamp": timestamp
            }
            # Publish to local broker
            self.client.publish("session/alerts", payload) 
        except Exception as e:
            logger.error(f"Failed to publish session alert: {e}")

    def send_system_alert(self, event: str, message: str, severity: str = "info", extra_data: Optional[dict] = None):
        """
        Handles a system-wide alert (e.g. device connection).
        1. Publishes to 'system/notifications'.
        """
        try:
            timestamp = datetime.now(timezone.utc).isoformat()
            payload = {
                "type": "app",
                "source": "edge",
                "event": event,
                "timestamp": timestamp,
                "message": message,
                "severity": severity
            }
            if extra_data:
                payload.update(extra_data)

            self.client.publish("system/notifications", payload)

        except Exception as e:
             logger.error(f"Failed to send system alert: {e}")
