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
from edge_server.services.alert_service import AlertManager


CONFIG_DIR = os.path.join(os.path.dirname(__file__), "../", "config")
DEFAULT_CONFIG_PATH = os.path.join(CONFIG_DIR, "session.json")
ALERTS_CONFIG_PATH = os.path.join(CONFIG_DIR, "alerts.json")


class SessionController:
    # MQTT Topics
    TOPIC_CMD_START = "controller/commands/start"
    TOPIC_CMD_STOP = "controller/commands/stop"
    TOPIC_CMD_PAUSE = "controller/commands/pause"
    TOPIC_CMD_RESUME = "controller/commands/resume"
    
    TOPIC_SESSION_STATUS = "session/status"
    TOPIC_SESSION_LIVE = "session/live"
    TOPIC_SESSION_HISTORY = "session/history"

    def __init__(self, client, device_controller=None):
        self.client = client
        self.device_controller = device_controller
        self.config = load_config(DEFAULT_CONFIG_PATH)
        self.detector = AnomalyDetector(ALERTS_CONFIG_PATH)
        self.db = DatabaseHelper("src/edge_server/database/models/sessions.db")
        self.sessions = SessionDAO(self.db)
        self.aggregator = DataAggregator(self.db, timeout=15, on_complete_callback=self.publish_measurement)
        self.alert_manager = AlertManager(self.db, self.client)
        
        # Initialize ML Service
        try:
            from edge_server.services.ml_service import MLService
            self.ml_service = MLService()
        except ImportError as e:
            logger.error(f"Failed to import MLService: {e}")
            self.ml_service = None


        
        # State
        self.session_active = False
        self.paused = False
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
            self.paused = False
            self.time_elapsed = 0

        # Create Session Objects
        sess_payload = self._create_session_payload(payload)
        db_record = self._prepare_db_record(sess_payload)
        self.active_session = db_record

        # 1. Open Aggregator Window BEFORE triggering client
        # This ensures the server is ready for the 'Immediate Publish' from the client
        self.aggregator.start_collection(
            self.id, 
            datetime.now(timezone.utc).isoformat(), 
            set(["rpi"]), # Initial expected source
            save_to_db=True,
            session_time=0
        )

        # 2. Persist and Notify
        self.client.publish(self.TOPIC_CMD_START, sess_payload.model_dump_json(), qos=1)
        self.db.add_record("sessions", db_record)
        logger.info(f"Session {self.id} is now ACTIVE")

        # Alert: Session Started
        self.alert_manager.send_session_alert(
            session_id=self.id,
            device_id="System",
            sensor_type="System",
            value=0,
            message="Session started",
            severity="success",
            timestamp=sess_payload.createdAt,
            cooldown_seconds=0
        )

        # Start Data Acquisition
        self._start_acquisition_thread(payload.get("settings", {}))
        self.publish_status()

    def stop_session(self):
        with self.session_lock:
            if not self.session_active:
                logger.warning("No active session to stop")
                return
            
            # Update DB
            now_iso = datetime.now(timezone.utc).isoformat()
            self.db.update_record(
                "sessions",
                self.id,
                {
                    "status": "completed", 
                    "end_time": now_iso,
                    "synced": 0
                },
                id_column="id"
            )
            
            # Persist and Notify Devices
            self.client.publish(self.TOPIC_CMD_STOP, json.dumps({"id": self.id}), qos=1)

            # Alert: Session Stopped
            self.alert_manager.send_session_alert(
                session_id=self.id,
                device_id="System",
                sensor_type="System",
                value=0,
                message="Session stopped",
                severity="success",
                timestamp=now_iso,
                cooldown_seconds=0
            )

            # Reset State
            self.session_active = False
            self.id = None
            self.time_elapsed = 0
            self.active_session = {}
            
            self.publish_status()

        # Stop Thread
        if self.acquisition_thread and self.acquisition_thread.is_alive() and self.acquisition_thread is not threading.current_thread():
            self.acquisition_thread.join(timeout=2)
            logger.info("Acquisition thread stopped successfully.")

    def pause_session(self):
        with self.session_lock:
            if self.session_active:
                self.paused = True
                now_iso = datetime.now(timezone.utc).isoformat()
                self.db.update_record("sessions", self.id, {"status": "paused", "synced": 0}, id_column="id")
                
                # Notify Devices
                self.client.publish(self.TOPIC_CMD_PAUSE, json.dumps({"id": self.id}), qos=1)
                logger.info(f"Session {self.id} paused")
                
                # Alert: Session Paused
                self.alert_manager.send_session_alert(
                    session_id=self.id,
                    device_id="System",
                    sensor_type="System",
                    value=0,
                    message="Session paused",
                    severity="info",
                    timestamp=now_iso,
                    cooldown_seconds=0
                )

                self.publish_status()

    def resume_session(self):
        with self.session_lock:
            if self.session_active:
                self.paused = False
                now_iso = datetime.now(timezone.utc).isoformat()
                self.db.update_record("sessions", self.id, {"status": "running", "synced": 0}, id_column="id")
                
                # Notify Devices
                self.client.publish(self.TOPIC_CMD_RESUME, json.dumps({"id": self.id}), qos=1)
                logger.info(f"Session {self.id} resumed")

                # Alert: Session Resumed
                self.alert_manager.send_session_alert(
                    session_id=self.id,
                    device_id="System",
                    sensor_type="System",
                    value=0,
                    message="Session resumed",
                    severity="info",
                    timestamp=now_iso,
                    cooldown_seconds=0
                )

                self.publish_status()

    def request_measurements(self):
        if not self.id:
            return
        topic = f"controller/session/{self.id}/measurement"
        self.client.publish(topic, json.dumps({"id": self.id}), qos=1)

    def request_sync_measurements(self):
        if not self.id:
            return
        topic = f"controller/session/{self.id}/measurement_sync"
        self.client.publish(topic, json.dumps({"id": self.id}), qos=1)

    def get_offline_sessions(self, user_email: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.db.get_offline_sessions(user_email)

    def assign_session_project(self, payload: Dict[str, Any]) -> None:
        session_id = payload.get("sessionId")
        project_id = payload.get("projectId")
        user_id = payload.get("userId")
        
        if not session_id or not project_id or not user_id:
            logger.error("Missing sessionId, projectId, or userId in assign_session_project")
            return
            
        logger.info(f"Assigning session {session_id} to project {project_id}")
        self.db.update_session_project(session_id, project_id, user_id)

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
            target=payload.get("target"),
            userEmail=payload.get("userEmail")
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
            "target": sess_payload.target,
            # Offline Support
            # If payload has 'userEmail', store it. If projectId is missing, mark offline.
            "user_email": getattr(sess_payload, "userEmail", None), 
            "is_offline": 1 if not sess_payload.projectId else 0
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

                if self.paused:
                    continue

                # Determine trigger type
                is_sync_loop = (self.time_elapsed % self.read_interval == 0)
                
                # Skip T=0 in the loop because it's handled by start_session()
                # to ensure window is open BEFORE the cmd_start is sent.
                if self.time_elapsed == 0:
                    time.sleep(1)
                    self.time_elapsed += 1
                    continue

                save_to_db = is_sync_loop # Save to DB only on sync loops

                # Dynamic Expected Sources
                # Fast Loop: Expect only RPi (assuming external devices are slow/sync-only)
                # Sync Loop: Expect RPi + All Online Devices
                expected_sources = set(["rpi"])
                logger.debug(f"Acquisition Loop: exp_sources={expected_sources}")
                
                if is_sync_loop and self.device_controller:
                     expected_sources.update(self.device_controller.online_devices.keys())
                
                # Note: If an external device IS fast, it will be ignored in fast loops with this logic.
                # However, this safely solves the Spectrometer issue without metadata.

                self.aggregator.start_collection(
                    self.id, 
                    datetime.now(timezone.utc).isoformat(), 
                    expected_sources,
                    save_to_db=save_to_db,
                    session_time=self.time_elapsed
                )

                if save_to_db:
                    logger.info(f"Requests measurements for session {self.id} (Saving to DB)")
                    # New Sync Trigger (for Slow Devices/Spec)
                    if not self.paused:
                        self.request_sync_measurements()
                else: 
                    # Always request measurements for live view (for Fast Devices/RPi)
                    # The Spectrometer (listening to sync topic) will ignore this.
                    # The Aggegator (expecting only RPi) will not wait for Spectrometer.
                    if not self.paused:
                        self.request_measurements()

                time.sleep(1)
                self.time_elapsed += 1
                self._send_heartbeat()

                duration = self.active_session.get("duration")
                if duration and isinstance(duration, (int, float)) and duration > 0:
                    if self.time_elapsed >= duration:
                        logger.info(f"Timer duration ({duration}s) reached. Stopping session.")
                        self.stop_session()
                        break

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
        self.client.publish(self.TOPIC_SESSION_STATUS, json.dumps(payload))

    # -------------------- Data Handling --------------------


    def _handle_session_data(self, device_id: str, payload: Dict[str, Any]):

        source = payload.get("source")
        data = payload.get("data", {})
        timestamp = payload.get("timestamp")
        logger.info(f"Received data from {device_id}: {data}")

        # 0. ML Prediction (Spectrometer only)
        # Check for both "wavelengths" (plural) and "wavelength" (singular)
        has_spectra = "spectra" in data
        
        # Normalize if singular is present but plural is missing
        if "wavelength" in data and "wavelengths" not in data:
             data["wavelengths"] = data["wavelength"]
        
        # Check for wavelengths presence AFTER normalization
        has_wavelengths = "wavelengths" in data

        logger.debug(f"ML Check [{device_id}]: Service={self.ml_service is not None}, Spectra={has_spectra}, WL={has_wavelengths}")

        if self.ml_service and has_spectra and has_wavelengths:
            try:
                logger.debug("Calling MLService.predict...")
                predictions = self.ml_service.predict(data)
                logger.debug(f"Received predictions: {predictions}")
                
                # Inject predictions into data so they are aggregated and saved
                if predictions.get("od") is not None:
                    data["od"] = {"value": predictions["od"], "unit": "OD", "sensor_type": "od"}
                
                if predictions.get("dissolved_co2") is not None:
                    data["co2"] = {"value": predictions["dissolved_co2"], "unit": "mg/L", "sensor_type": "co2"}
                    
            except Exception as e:
                logger.error(f"Failed to run ML prediction: {e}")
        else:
             logger.debug("Skipping ML prediction.")

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
            # 1. Global Anomaly Detection
            for sensor_type, reading in data.items():
                if isinstance(reading, dict) and "value" in reading:
                    value = float(reading.get("value"))
                    alert_msg = self.detector.check_reading(reading.get("sensor_type"), value)
                    
                    if alert_msg:
                        self._handle_anomaly(session_id, device_id, sensor_type, value, alert_msg, timestamp)

            # 2. Session-Specific Alert Configuration
            if not self.active_session:
                return

            alert_config_str = self.active_session.get("alert_configuration")
            if not alert_config_str:
                return

            try:
                alert_configs = json.loads(alert_config_str)
            except json.JSONDecodeError:
                logger.warning("Failed to parse alert configuration JSON")
                return

            for config in alert_configs:
                if not config.get("enabled"):
                    continue

                target_type = config.get("alertType") # e.g. "temperature", "ph"
                threshold = config.get("threshold")
                
                # Check if this type exists in the current data payload
                # Data payload format: {"temp": {"value": 25, ...}, "ph": {"value": 7, ...}}
                # We need to map config type to data key. Assuming 1:1 or logic:
                # config.alertType usually matches keys like "temperature" but data keys might be "temp".
                # Let's handle the mapping or assume keys match.
                # In frontend: settings use "temperature", "ph", "od", "co2".
                # In backend data: "temp", "ph", "od", "co2".
                
                reading_key = target_type
                if target_type == "temperature":
                    reading_key = "temp"
                
                if reading_key not in data:
                    continue

                reading = data[reading_key]
                if isinstance(reading, dict) and "value" in reading:
                    val = float(reading.get("value"))
                    
                    # Logic: Threshold check (Max Limit)
                    if val > float(threshold):
                        msg = f"{target_type.upper()} threshold exceeded: {val:.2f} > {threshold}"
                        self.alert_manager.send_session_alert(
                            session_id=session_id,
                            device_id=device_id,
                            sensor_type=target_type,
                            value=val,
                            message=msg,
                            severity="warning",
                            timestamp=timestamp,
                            cooldown_seconds=30 # Prevent spam
                        )

        except Exception as e:
            logger.error(f"Error in anomaly/alert processing: {e}")

    def _handle_anomaly(self, session_id: str, device_id: str, sensor_type: str, value: float, message: str, timestamp: str):
        self.alert_manager.send_session_alert(
            session_id=session_id,
            device_id=device_id,
            sensor_type=sensor_type,
            value=value,
            message=message,
            severity="warning",
            timestamp=timestamp
        )


    def publish_measurement(self, payload: Dict[str, Any]):
        """
        Callback from aggregator when a unified measurement is ready.
        """
        try:
            live_payload = {
                "timestamp": payload.get("timestamp"),
                "data": payload.get("data"),
                "source": "aggregator", # Unified source
                "session_id": payload.get("session_id"),
                "session_time": payload.get("session_time"),
                "is_recorded": payload.get("is_recorded")
            }
            self.client.publish(self.TOPIC_SESSION_LIVE, json.dumps(live_payload))

            # 2. Publish History ONLY if recorded (saved to DB)
            if payload.get("is_recorded"):
                self.publish_history(payload.get("session_id"))

        except Exception as e:
            logger.error(f"Error publishing measurement: {e}")

    def publish_history(self, session_id: str):
        history = self.db.get_unified_measurements(session_id)
        alerts = self.db.get_session_alerts(session_id)
        payload = {
            "session_id": session_id,
            "history": history,
            "alerts": alerts,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.client.publish(self.TOPIC_SESSION_HISTORY, json.dumps(payload))
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
        
        self.client.publish(topic, json.dumps(payload), retain=True)
        logger.info(f"Published session status: {status_payload.get('status')}")

    def _map_active_session_to_status(self) -> Dict[str, Any]:
        """Maps snake_case DB record to camelCase frontend payload"""
        return {
            "id": self.id,
            "projectId": self.active_session.get("project_id"),
            "userId": self.active_session.get("user_id"),
            "createdAt": self.active_session.get("start_time"),
            "status": "paused" if self.paused else "running",
            "sessionDetails": json.loads(self.active_session.get("session_details", "{}")),
            "settings": json.loads(self.active_session.get("settings", "{}")),
            "alertConfiguration": json.loads(self.active_session.get("alert_configuration", "[]")),
            "notes": self.active_session.get("notes"),
            "duration": self.active_session.get("duration"),
            "target": self.active_session.get("target"),
            "time": self.time_elapsed,
            "active": True
        }
