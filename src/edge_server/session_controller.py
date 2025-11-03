import json
import sys
import os
import threading
from datetime import datetime, timezone
from queue import Empty
from uuid import uuid4
from database.db_manager import DatabaseHelper, SessionDAO
from models.schemas import SessionPayload
from controllers.command_handler import CommandHandler
from services.heartbeat_service import HeartbeatService


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
from shared.utils.logger import logger
from shared.utils.config_loader import load_config

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "config")
DEFAULT_CONFIG_PATH = os.path.join(CONFIG_DIR, "session.json")


class SessionController(threading.Thread):

    def __init__(self, mqtt_subscriber, aws):
        super().__init__(daemon=True)
        self.mqtt = mqtt_subscriber
        self.aws = aws
        self.config = load_config(DEFAULT_CONFIG_PATH)
        self.db = DatabaseHelper("src/edge_server/database/models/sessions.db")
        self.sessions = SessionDAO(self.db)
        self.command_handler = CommandHandler(self)
        self.heartbeat = HeartbeatService(self.aws, self._get_online_status, interval=30)

        self.session_active = False
        self.online_devices = {}
        self.session_lock = threading.Lock()
        self._stop_event = threading.Event()
        self.time_elapsed = 0
        self.session_id = None

        self.in_queue = getattr(self.mqtt, "data_queue", None)
        if self.in_queue is None:
            raise RuntimeError("mqtt_subscriber missing data_queue")
        
    def stop(self):
        self._stop_event.set()
    
    def run(self):
        logger.info("SessionController main loop starting")
        self.heartbeat.start()

        while not self._stop_event.is_set():
            try:
                msg = self.in_queue.get(timeout=0.5)
                topic, payload = msg.get("topic", ""), msg.get("payload", {})

                if topic.startswith("/devices/"):
                    self.command_handler.handle_device_message(topic, payload)
                elif topic.startswith("ui/"):
                    self.command_handler.handle_ui_command( payload)
                
            except Empty:
                continue
            except Exception:
                logger.exception("Error in main loop")

        self.heartbeat.stop()
        logger.info("SessionController stopped")

    # -------------------- Session Management --------------------
    def start_session(self, payload):
        with self.session_lock:
            if self.session_active:
                logger.warning("Session already active")
                return
            self.session_id = f"session_{uuid4()}"
            self.session_active = True  

        sess_payload  = SessionPayload(
            session_id=self.session_id,
            project_id=payload.get("project_id", ""),
            start_time=datetime.now(timezone.utc).isoformat(),
            active=1,
            user=payload.get("user", ""),
            notes=payload.get("notes", None)
        )
        self.mqtt.client.publish("/controller/commands/start", sess_payload.model_dump_json(), qos=1)
        self.db.add_record("sessions", sess_payload.model_dump())
        logger.info(f"Session {self.session_id} is now ACTIVE")
        
        self.acquisition_thread = threading.Thread(target=self._acquisition_loop, daemon=True)
        self.acquisition_thread.start()


    def stop_session(self):
        with self.session_lock:
            if not self.session_active:
                logger.warning("No active session to stop")
                return
            self.db.update_record(
                "sessions",
                self.session_id,
                {"active": 0, "end_time": datetime.now(timezone.utc).isoformat()},
                id_column="session_id"
            )
            self.session_active = False
            self.session_id = None
            self.time_elapsed = 0

        if hasattr(self, "acquisition_thread") and self.acquisition_thread.is_alive():
            self.acquisition_thread.join(timeout=2)
            logger.info("Acquisition thread stopped successfully.")

    def _acquisition_loop(self):
        try:
            self.read_interval = self.config.get("sampling").get("sensor_interval", 30)
            logger.info(f"Data aquisition loop started. Sending data every {self.read_interval} s")
            while self.session_active:
                if self.time_elapsed % self.read_interval == 0:
                    self.request_measurements()
                self._stop_event.wait(1)
                self.time_elapsed += 1

        except Exception as e:
            logger.error(f"Unexpected error in acquisition loop: {e}")
        finally: 
            self.db.close()

    def request_measurements(self):
        self.mqtt.client.publish(
            f"/controller/session/{self.session_id}/measurement",
            json.dumps({"session_id": self.session_id}),
            qos=1
        )


    # -------------------- Device Handling --------------------
    def _handle_device_registration(self, device_id, payload): 
        if device_id in self.online_devices: 
            logger.info(f"Device {device_id} is already registered")
            return 
        self.online_devices[device_id] = payload
        logger.info(f"Device {device_id} registered")

    def _handle_device_disconnect(self, device_id, payload): 
        self.online_devices.pop(device_id, None)
        logger.info(f"Device {device_id} unregistered")

    def _handle_device_status(self, device_id, payload): 
         self.online_devices[device_id] = True

    def _handle_device_data(self, device_id, payload): 
        logger.info(f"Data received from device {device_id}: {payload}")
        self.db.insert_measurement(
            session_id=payload.get("session_id"),
            source=payload.get("source"),
            data=json.dumps(payload.get("data")),
            timestamp_iso=payload.get("timestamp")
            
        )
        self.aws.publish_sensor_data(payload)

    def _get_online_status(self):
        return {d: True for d in self.online_devices.keys()}