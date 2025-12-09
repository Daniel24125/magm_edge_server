import json, sys, os, time
from uuid import uuid4
from models.schemas import SessionPayload
from datetime import datetime, timezone
import threading
from database.db_manager import  SessionDAO, DatabaseHelper

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
from shared.utils.logger import logger
from shared.utils.config_loader import load_config
from edge_server.services.anomaly_detector import AnomalyDetector

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "../","config")
DEFAULT_CONFIG_PATH = os.path.join(CONFIG_DIR, "session.json")
ALERTS_CONFIG_PATH = os.path.join(CONFIG_DIR, "alerts.json")


class SessionController: 
    def __init__(self, mqtt, aws):
        self.mqtt = mqtt
        self.aws = aws
        self.config = load_config(DEFAULT_CONFIG_PATH)
        self.detector = AnomalyDetector(ALERTS_CONFIG_PATH)
        self.db = DatabaseHelper("src/edge_server/database/models/sessions.db")
        self.sessions = SessionDAO(self.db)
        self.session_active = False
        self.session_lock = threading.Lock()
        self.time_elapsed = 0
        self.id = None
        self.last_saved_map = {}


     # -------------------- Session Management --------------------
    def start_session(self, payload):
        with self.session_lock:
            if self.session_active:
                logger.warning("Session already active")
                return
            
            # Use provided ID or generate
            self.id = payload.get("id") or f"session_{uuid4()}"
            self.session_active = True  

        sess_payload  = SessionPayload(
            id=self.id,
            projectId=payload.get("projectId", ""),
            userId=payload.get("userId", ""),
            createdAt=datetime.now(timezone.utc).isoformat(),
            status="running",
            sessionDetails=payload.get("sessionDetails", {}),
            settings=payload.get("settings", {}),
            alertConfiguration=payload.get("alertConfiguration", []),
            notes=payload.get("notes", None),
            duration=payload.get("duration"),
            target=payload.get("target")
        )
        
        # Serialize complex objects for DB
        # Map camelCase model fields to snake_case DB columns
        db_record = {
            "id": sess_payload.id,
            "project_id": sess_payload.projectId,
            "user_id": sess_payload.userId,
            "start_time": sess_payload.createdAt,
            "status": sess_payload.status,
            "session_details": json.dumps(sess_payload.sessionDetails),
            "settings": json.dumps(sess_payload.settings),
            "alert_configuration": json.dumps(sess_payload.alertConfiguration),
            "notes": sess_payload.notes,
            "duration": sess_payload.duration,
            "target": sess_payload.target
        }
        self.active_session = db_record

        self.mqtt.client.publish("/controller/commands/start", sess_payload.model_dump_json(), qos=1)
        self.db.add_record("sessions", db_record)
        logger.info(f"Session {self.id} is now ACTIVE")
        
        # Apply Session Settings
        settings = payload.get("settings", {})
        # Start acquisition with settings
        self.acquisition_thread = threading.Thread(target=self._acquisition_loop, args=(settings,), daemon=True)
        self.acquisition_thread.start()
        self.publish_status()


    def stop_session(self):
        with self.session_lock:
            if not self.session_active:
                logger.warning("No active session to stop")
                return
            self.db.update_record(
                "sessions",
                self.id,
                {"status": "completed", "end_time": datetime.now(timezone.utc).isoformat()},
                id_column="id"
            )
            self.session_active = False
            self.id = None
            self.time_elapsed = 0
            self.last_saved_map = {}
            
            self.publish_status()

        if hasattr(self, "acquisition_thread") and self.acquisition_thread.is_alive():
            self.acquisition_thread.join(timeout=2)
            logger.info("Acquisition thread stopped successfully.")

    def _acquisition_loop(self, settings=None):
        try:
            default_interval = self.config.get("sampling").get("sensor_interval", 30)
            if settings and "dataAcquisitionInterval" in settings:
                try:
                    self.read_interval = int(settings["dataAcquisitionInterval"])
                except (ValueError, TypeError):
                    logger.warning("Invalid dataAcquisitionInterval in settings, using default")
                    self.read_interval = default_interval
            else:
                self.read_interval = default_interval

            logger.info(f"Data aquisition loop started. Sending data every {self.read_interval} s")
            while self.session_active:
                if self.time_elapsed % self.read_interval == 0:
                    logger.info(f"\n\n\n Requesting measurements for session {self.id}\n\n\n")
                    self.request_measurements()
                time.sleep(1)
                self.time_elapsed += 1
                
                # Send heartbeat
                self.aws.client.publish("session/status", json.dumps({
                    "type": "session_tick",
                    "payload": {
                        "id": self.id,
                        "time": self.time_elapsed,
                        "status": "running"
                    }, 
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }))

        except Exception as e:
            logger.error(f"Unexpected error in acquisition loop: {e}")
        finally: 
            self.db.close()

    def request_measurements(self):
        self.mqtt.client.publish(
            f"/controller/session/{self.id}/measurement",
            json.dumps({"id": self.id}),
            qos=1
        )

    def _handle_session_data(self,  device_id, payload):
        source = payload.get("source")
        key = f"{device_id}_{source}"
        now = time.time()
        # Anomaly Detection
        try:
            data = payload.get("data", {})
            if isinstance(data, dict):
                for sensor_type, reading in data.items():

                    value = float(reading.get("value"))
                    alert_msg = self.detector.check_reading(reading.get("sensor_type"), value)
                    if alert_msg:
                        logger.warning(f"Anomaly detected: {alert_msg}")
                        # 1. Save to DB
                        self.db.insert_alert(
                            session_id=payload.get("id"),
                            sensor_type=sensor_type,
                            value=value,
                            message=alert_msg,
                            timestamp_iso=payload.get("timestamp")
                        )
                        # 2. Notify User (AWS)
                        self.aws.publish_alert({
                            "id": payload.get("id"),
                            "device_id": device_id,
                            "sensor_type": sensor_type,
                            "value": value,
                            "message": alert_msg,
                            "timestamp": payload.get("timestamp")
                        })
        except Exception as e:
            logger.error(f"Error in anomaly detection: {e}")
        
        last_saved = self.last_saved_map.get(key, 0)
        if now - last_saved >= 60:
            self.db.insert_measurement(
                session_id=payload.get("id"),
                source=source,
                data=json.dumps(payload.get("data")),
                timestamp_iso=payload.get("timestamp")
            )
            self.last_saved_map[key] = now
            logger.info(f"Stored measurement for {key}")
        else:
            # Data skipped for storage (downsampling)
            pass

    def publish_status(self):
        """
        Publishes the current session status to /devices/{device_id}/session/status
        """
        from sensor_client.config.config_manager import ConfigManager
        device_id = ConfigManager().get_config().get("device_config").get("device_id")
        topic = "session/status"
        if self.session_active:
             # Map snake_case DB columns (from active_session) to camelCase frontend fields
            status_payload = {  
                "id": self.id,
                "projectId": self.active_session.get("project_id"),
                "userId": self.active_session.get("user_id"),
                "createdAt": self.active_session.get("start_time"),
                "status": "running",
                "sessionDetails": json.loads(self.active_session.get("session_details", "{}")),
                "settings": json.loads(self.active_session.get("settings", "{}")),
                "alertConfiguration": json.loads(self.active_session.get("alert_configuration", "[]")),
                "notes": self.active_session.get("notes"),
                "duration": self.active_session.get("duration"),
                "target": self.active_session.get("target"),
                "active": True # Compatibility
            }
        else:
            status_payload = {
                "id": self.id,
                "active": False,
                "status": "idle"
            }
        
        payload = {
            "type": "session",
            "payload": status_payload,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        self.aws.client.publish(topic, json.dumps(payload))
        logger.info(f"Published session status to {topic}: {payload}")
