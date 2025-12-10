from typing import Optional, Any
from datetime import datetime, timezone
from shared.utils.logger import logger

class AlertManager:
    """
    Centralized service for handling system and session alerts.
    ensures consistency between database persistence and frontend notifications.
    """
    def __init__(self, db_helper: Any, aws_client: Any):
        self.db = db_helper
        self.aws = aws_client
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
        3. Publishes to AWS 'ui/alerts'.
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
            logger.info(f"Persisted session alert for {session_id}: {message} ({severity})")
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
            # Uses existing aws.publish_alert method which handles topic 'ui/alerts'
            self.aws.publish_alert(payload) 
        except Exception as e:
            logger.error(f"Failed to publish session alert to AWS: {e}")

    def send_system_alert(self, event: str, message: str, severity: str = "info", extra_data: Optional[dict] = None):
        """
        Handles a system-wide alert (e.g. device connection).
        1. Publishes to 'system/notifications'.
        (System alerts are currently not persisted to DB, per existing logic)
        """
        try:
            # Uses existing aws._notify_user method which handles topic 'system/notifications'
            # Note: _notify_user might be private, considering making it public or wrapping.
            
            # Inject severity into extra_data or payload
            if extra_data is None:
                extra_data = {}
            extra_data["severity"] = severity

            if hasattr(self.aws, '_notify_user'):
                self.aws._notify_user(event, message, extra_data)
            else:
                 logger.warning("AWS client does not have _notify_user method")
        except Exception as e:
             logger.error(f"Failed to send system alert: {e}")
