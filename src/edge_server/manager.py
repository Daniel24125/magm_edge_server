import sys
import os
import threading
from queue import Empty
from controllers.command_handler import CommandHandler


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
from shared.utils.logger import logger

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "config")
DEFAULT_CONFIG_PATH = os.path.join(CONFIG_DIR, "session.json")


class ManagerController(threading.Thread):

    def __init__(self, client):
        super().__init__(daemon=True)
        self.client = client

        # Initialize shared services
        from database.db_manager import DatabaseHelper
        from services.alert_service import AlertManager
        from services.firebase_sync import FirebaseSyncService
        
        self.db_helper = DatabaseHelper("src/edge_server/database/models/sessions.db")
        self.alert_manager = AlertManager(self.db_helper, self.client)
        
        # Start Firebase Sync (Daemon)
        self.firebase_sync = FirebaseSyncService(self.db_helper)
        self.firebase_sync.start()

        self.command_handler = CommandHandler(client, self.alert_manager, self.db_helper)
        self._stop_event = threading.Event()

        self.in_queue = getattr(self.client, "data_queue", None)
        if self.in_queue is None:
            raise RuntimeError("mqtt client missing data_queue")
        
    def run(self):
        logger.info("Manager main loop starting")

        while not self._stop_event.is_set():
            try:
                msg = self.in_queue.get(timeout=0.5)
                topic, payload = msg.get("topic", ""), msg.get("payload", {})

                if topic.endswith("events"):
                    logger.info(f"DEBUG MANAGER: Received event msg keys: {list(msg.keys())}")
                    logger.info(f"DEBUG MANAGER: msg payload: {msg}")
                    
                if topic.startswith("devices/") or topic.startswith("/devices/"):
                    self.command_handler.handle_device_message(topic, payload)
                elif topic.startswith("ui/") or topic.startswith("/ui/"):
                    self.command_handler.handle_ui_command( payload)
                elif topic.startswith("magm/calibration/"):
                    self.command_handler.handle_calibration_message(topic, payload)
                else: 
                    logger.warning(f"Command not recognized: {topic}")
            except Empty:
                continue
            except Exception:
                logger.exception("Error in main loop")

        logger.info("Manager stopped")
    
    def _handle_user_prompt(self, payload, command): 
        # Forward to UI via MQTT
        # self.client.publish(...) - logic handled inside command handler/device controller
        pass

    
    def stop(self):
        self._stop_event.set()
        if hasattr(self, 'firebase_sync'):
            self.firebase_sync.stop()

