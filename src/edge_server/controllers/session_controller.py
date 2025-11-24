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

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "../","config")
DEFAULT_CONFIG_PATH = os.path.join(CONFIG_DIR, "session.json")


class SessionController: 
    def __init__(self, mqtt):
        self.mqtt = mqtt
        self.config = load_config(DEFAULT_CONFIG_PATH)
        self.db = DatabaseHelper("src/edge_server/database/models/sessions.db")
        self.sessions = SessionDAO(self.db)
        self.session_active = False
        self.session_lock = threading.Lock()
        self.time_elapsed = 0
        self.session_id = None


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
                time.sleep(1)
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

    def _handle_session_data(self,  device_id, payload):
        self.db.insert_measurement(
            session_id=payload.get("session_id"),
            source=payload.get("source"),
            data=json.dumps(payload.get("data")),
            timestamp_iso=payload.get("timestamp")
        )