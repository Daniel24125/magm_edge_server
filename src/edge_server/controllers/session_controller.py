import json, sys, os, time
from uuid import uuid4
from typing import Dict, Any, Optional, List
import threading
from datetime import datetime, timezone

from models.schemas import SessionPayload
from database.db_manager import SessionDAO, DatabaseHelper
from edge_server.services.aggregator import DataAggregator

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger
from shared.utils.config_loader import load_config
from edge_server.services.anomaly_detector import AnomalyDetector

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "../", "config")
DEFAULT_CONFIG_PATH = os.path.join(CONFIG_DIR, "session.json")
ALERTS_CONFIG_PATH = os.path.join(CONFIG_DIR, "alerts.json")


class SessionController:
    # MQTT Topics
    TOPIC_CMD_START = "/controller/commands/start"
    TOPIC_SESSION_STATUS = "session/status"
    TOPIC_SESSION_LIVE = "session/live"
    TOPIC_SESSION_HISTORY = "session/history"

    def __init__(self, mqtt, aws, device_controller=None):
        self.mqtt = mqtt
        self.aws = aws
        self.device_controller = device_controller
        self.config = load_config(DEFAULT_CONFIG_PATH)
        self.detector = AnomalyDetector(ALERTS_CONFIG_PATH)
        self.db = DatabaseHelper("src/edge_server/database/models/sessions.db")
        self.sessions = SessionDAO(self.db)
        self.aggregator = DataAggregator(self.db, timeout=15, on_complete_callback=self.publish_measurement)
        
        # State
        self.session_active = False
        self.session_lock = threading.Lock()
        self.time_elapsed = 0
        self.id: Optional[str] = None
        self.active_session: Dict[str, Any] = {}
        self.read_interval = 30
        self.acquisition_thread: Optional[threading.Thread] = None

    # -------------------- Session Management --------------------

    def start_session(self, payload: Dict[str, Any]):
        with self.session_lock:
            if self.session_active:
                logger.warning("Session already active")
                return

            # Initialize Session ID
            self.id = payload.get("id") or f"session_{uuid4()}"
            self.session_active = True

        # Create Session Objects
        sess_payload = self._create_session_payload(payload)
        db_record = self._prepare_db_record(sess_payload)
        self.active_session = db_record

        # Persist and Notify
        self.mqtt.client.publish(self.TOPIC_CMD_START, sess_payload.model_dump_json(), qos=1)
        self.db.add_record("sessions", db_record)
        logger.info(f"Session {self.id} is now ACTIVE")

        # Start Data Acquisition
        self._start_acquisition_thread(payload.get("settings", {}))
        self.publish_status()

    def stop_session(self):
        with self.session_lock:
            if not self.session_active:
                logger.warning("No active session to stop")
                return
            
            # Update DB
            self.db.update_record(
                "sessions",
                self.id,
                {"status": "completed", "end_time": datetime.now(timezone.utc).isoformat()},
                id_column="id"
            )
            
            # Reset State
            self.session_active = False
            self.id = None
            self.time_elapsed = 0
            self.active_session = {}
            
            self.publish_status()

        # Stop Thread
        if self.acquisition_thread and self.acquisition_thread.is_alive():
            self.acquisition_thread.join(timeout=2)
            logger.info("Acquisition thread stopped successfully.")

    def request_measurements(self):
        if not self.id:
            return
        topic = f"/controller/session/{self.id}/measurement"
        self.mqtt.client.publish(topic, json.dumps({"id": self.id}), qos=1)

    # -------------------- Internal Helpers --------------------

    def _create_session_payload(self, payload: Dict[str, Any]) -> SessionPayload:
        return SessionPayload(
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

    def _prepare_db_record(self, sess_payload: SessionPayload) -> Dict[str, Any]:
        return {
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

    def _start_acquisition_thread(self, settings: Dict[str, Any]):
        self.acquisition_thread = threading.Thread(
            target=self._acquisition_loop, 
            args=(settings,), 
            daemon=True
        )
        self.acquisition_thread.start()

    def _acquisition_loop(self, settings: Dict[str, Any] = None):
        try:
            self._configure_read_interval(settings)
            
            # Using list for predictable iteration order if needed, but set for logic
            expected_sources = set(["rpi"]) 
            
            while self.session_active:
                # Update expected sources dynamically
                if self.device_controller:
                    expected_sources = set(self.device_controller.online_devices.keys())
                    expected_sources.add("rpi")

                # Determine if this cycle should be saved to DB (History)
                save_to_db = (self.time_elapsed % self.read_interval == 0)

                self.aggregator.start_collection(
                    self.id, 
                    datetime.now(timezone.utc).isoformat(), 
                    expected_sources,
                    save_to_db=save_to_db
                )

                if save_to_db:
                    logger.info(f"Requests measurements for session {self.id}")
                    self.request_measurements()

                time.sleep(1)
                self.time_elapsed += 1
                self._send_heartbeat()

        except Exception as e:
            logger.error(f"Unexpected error in acquisition loop: {e}")
        finally:
            self.db.close()

    def _configure_read_interval(self, settings: Optional[Dict[str, Any]]):
        default_interval = self.config.get("sampling", {}).get("sensor_interval", 30)
        self.read_interval = default_interval
        
        if settings and "dataAcquisitionInterval" in settings:
            try:
                self.read_interval = int(settings["dataAcquisitionInterval"])
            except (ValueError, TypeError):
                logger.warning("Invalid dataAcquisitionInterval, using default")
        
        logger.info(f"Data acquisition started. Interval: {self.read_interval}s")

    def _send_heartbeat(self):
        payload = {
            "type": "session_tick",
            "payload": {
                "id": self.id,
                "time": self.time_elapsed,
                "status": "running"
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.aws.client.publish(self.TOPIC_SESSION_STATUS, json.dumps(payload))

    # -------------------- Data Handling --------------------

    def _handle_session_data(self, device_id: str, payload: Dict[str, Any]):
        source = payload.get("source")
        data = payload.get("data", {})
        timestamp = payload.get("timestamp")

        # 1. Anomaly Detection
        self._process_anomalies(device_id, data, payload.get("id"), timestamp)

        # 2. Aggregation
        self.aggregator.add_reading(source, data)

        # 3. Live Preview (REMOVED - Aggregator now handles live updates)
        # self._publish_live_preview(source, data)

    def _process_anomalies(self, device_id: str, data: Any, session_id: str, timestamp: str):
        if not isinstance(data, dict):
            return

        try:
            for sensor_type, reading in data.items():
                if isinstance(reading, dict) and "value" in reading:
                    value = float(reading.get("value"))
                    alert_msg = self.detector.check_reading(reading.get("sensor_type"), value)
                    
                    if alert_msg:
                        self._handle_anomaly(session_id, device_id, sensor_type, value, alert_msg, timestamp)
        except Exception as e:
            logger.error(f"Error in anomaly detection: {e}")

    def _handle_anomaly(self, session_id: str, device_id: str, sensor_type: str, value: float, message: str, timestamp: str):
        logger.warning(f"Anomaly detected: {message}")
        
        # Save to DB
        self.db.insert_alert(
            session_id=session_id,
            sensor_type=sensor_type,
            value=value,
            message=message,
            timestamp_iso=timestamp
        )
        
        # Notify User via AWS
        self.aws.publish_alert({
            "id": session_id,
            "device_id": device_id,
            "sensor_type": sensor_type,
            "value": value,
            "message": message,
            "timestamp": timestamp
        })

    def _publish_live_preview(self, source: str, data: Any):
        # Deprecated: Aggregator sends unified live preview
        pass

    def publish_measurement(self, payload: Dict[str, Any]):
        """
        Callback from aggregator when a unified measurement is ready.
        """
        try:
            # 1. Always publish Live Measurement (Unified)
            # Ensure it matches frontend expectations for 'session/live'
            # FE expects: { timestamp, data (flat), source? }
            # Aggregator data is flat.
            live_payload = {
                "timestamp": payload.get("timestamp"),
                "data": payload.get("data"),
                "source": "aggregator", # Unified source
                "session_id": payload.get("session_id")
            }
            self.aws.client.publish(self.TOPIC_SESSION_LIVE, json.dumps(live_payload))

            # 2. Publish History ONLY if recorded (saved to DB)
            if payload.get("is_recorded"):
                self.publish_history(payload.get("session_id"))
                
        except Exception as e:
            logger.error(f"Error publishing measurement: {e}")

    def publish_history(self, session_id: str):
        history = self.db.get_unified_measurements(session_id)
        payload = {
            "session_id": session_id,
            "history": history,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.aws.client.publish(self.TOPIC_SESSION_HISTORY, json.dumps(payload))
        logger.info(f"Published history for {session_id} ({len(history)} records)")

    def publish_status(self):
        topic = self.TOPIC_SESSION_STATUS
        
        if self.session_active:
            status_payload = self._map_active_session_to_status()
        else:
            status_payload = {"id": self.id, "active": False, "status": "idle"}
        
        payload = {
            "type": "session",
            "payload": status_payload,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        self.aws.client.publish(topic, json.dumps(payload))
        logger.info(f"Published session status: {status_payload.get('status')}")

    def _map_active_session_to_status(self) -> Dict[str, Any]:
        """Maps snake_case DB record to camelCase frontend payload"""
        return {
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
            "active": True
        }
