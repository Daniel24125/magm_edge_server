import json
import sys
import os
import time
import threading
from queue import Empty, Queue
from typing import Dict, Any, Optional, Set
import uuid


project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.utils.logger import logger
from shared.utils.config_loader import load_config, save_config

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "config")
DEFAULT_CONFIG_PATH = os.path.join(CONFIG_DIR, "session.json")


class SessionController(threading.Thread):
    def __init__(self, mqtt_subscriber):
        super().__init__(daemon=True)
        self.mqtt = mqtt_subscriber
        self.init_variables()
        
    # -------------------- Initialization --------------------
    def init_variables(self):
        self.in_queue = getattr(self.mqtt, "data_queue", None)
        if self.in_queue is None:
            raise RuntimeError("mqtt_subscriber does not expose data_queue; ensure it places messages into a shared queue")

        self.config = load_config(DEFAULT_CONFIG_PATH)

        self.current_session: Optional[str] = None
        self.session_active = False
        self.session_lock = threading.Lock()

        self.online_devices: Dict[str, Dict[str, Any]] = {}      # device_id -> status payload
        self.latest_device_data: Dict[str, Dict[str, Any]] = {} # device_id -> last payload

        self._stop_event = threading.Event()
   
    def _save_config(self):
        save_config(DEFAULT_CONFIG_PATH, self.config)
        self.mqtt.client.publish("/controller/status/session_config_updated", json.dumps(self.config), qos=1)
        logger.info("Session config persisted and published to /controller/status/session_config_updated")

    # -------------------- Public API --------------------
    def stop(self):
        self._stop_event.set()

    def start_session(self, session_id: Optional[str] = None):
        with self.session_lock:
            if self.session_active:
                logger.warning("Session already active")
                return
            self.current_session = session_id or f"session_{uuid.uuid4()}"
            self.session_active = False  

        logger.info(f"Starting session {self.current_session}")
        # publish start command to devices
        start_payload = {
            "session_id": self.current_session,
            "start_time": int(time.time() * 1000)
        }
        self.mqtt.client.publish("/controller/commands/start", json.dumps(start_payload), qos=1)

        sync_payload = {"session_id": self.current_session, "action": "SYNC_START", "start_time": int(time.time() * 1000)}
        self.mqtt.client.publish("/controller/commands/sync", json.dumps(sync_payload), qos=1)
        self.session_active = True
        logger.info(f"Session {self.current_session} is now ACTIVE")

    def stop_session(self):
        with self.session_lock:
            if not self.session_active:
                logger.warning("No active session to stop")
                return
            stop_payload = {"session_id": self.current_session, "timestamp": int(time.time() * 1000)}
            self.mqtt.client.publish("/controller/commands/stop", json.dumps(stop_payload), qos=1)
            logger.info(f"Published stop for {self.current_session}")
            self.session_active = False
            self.current_session = None

    # -------------------- Main loop --------------------
    def run(self):
        logger.info("SessionController main loop starting")
        while not self._stop_event.is_set():
            try:
                msg = self.in_queue.get(timeout=0.5)
                topic = msg.get("topic")
                payload = msg.get("payload") or {}
                # route messages
                if topic.startswith("/devices/"):
                  self.parse_device_commands(payload, topic)
                elif topic == "/ui/commands/configure_session":
                    self._handle_config_update(payload)
                elif topic == "/ui/commands/start_session":
                    session_id = payload.get("session_id")
                    self.start_session(session_id=session_id)
                elif topic == "/ui/commands/stop_session":
                    self.stop_session()
                elif topic == "/ui/commands/start_session_confirm":
                    # handled inline during start; can also be used externally
                    pass
                else:
                    # other topics ignored for now
                    pass

                # if session active, attempt aggregation when frequency elapses
                if self.session_active:
                    self._run_aggregation_cycle()

            except Empty:
                # still run aggregation cycle periodically
                if self.session_active:
                    self._run_aggregation_cycle()
                continue
            except Exception:
                logger.exception("Error in main loop")

        logger.info("SessionController stopped")

    def parse_device_commands(self, payload, topic): 
        logger.info(f"payload: {payload}")
        if not "device_id" in payload: 
            raise Exception("The device id must be provided")
        
        device_id = payload.get("device_id")
        if topic.endswith("/status"):
            self._handle_device_status(device_id, payload)
        elif topic.endswith("/data"):
            self._handle_device_data(device_id, payload)
        elif topic.endswith("/register"):
            self._handle_device_registration(device_id, payload)
        elif topic.endswith("/unregister"):
            self._handle_device_disconnect(device_id, payload)

    # -------------------- Device Commands --------------------

    def _handle_device_registration(self, device_id, payload): 
        if device_id in self.online_devices: 
            logger.info(f"Device {device_id} is already registered")
            return 
        self.online_devices[device_id] = payload
        logger.info(f"Device {device_id} registered - {self.online_devices}")

    def _handle_device_disconnect(self, device_id, payload): 
        self.online_devices.pop(device_id, None)
        logger.info(f"Device {device_id} unregistered - {self.online_devices}")