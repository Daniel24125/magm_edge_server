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

    def __init__(self, mqtt, aws):
        super().__init__(daemon=True)
        self.mqtt = mqtt
        self.aws = aws
        self.command_handler = CommandHandler(mqtt, aws)
        self._stop_event = threading.Event()

        self.in_queue = getattr(self.mqtt, "data_queue", None)
        if self.in_queue is None:
            raise RuntimeError("mqtt missing data_queue")
        
    def run(self):
        logger.info("Manager main loop starting")

        while not self._stop_event.is_set():
            try:
                msg = self.in_queue.get(timeout=0.5)
                topic, payload = msg.get("topic", ""), msg.get("payload", {})
                if topic.startswith("devices/") or topic.startswith("/devices/"):
                    self.command_handler.handle_device_message(topic, payload)
                elif topic.startswith("ui/") or topic.startswith("/ui/"):
                    self.command_handler.handle_ui_command( payload)
                else: 
                    logger.warning("Command not recognized...")
            except Empty:
                continue
            except Exception:
                logger.exception("Error in main loop")

        logger.info("Manager stopped")
    
    def _handle_user_prompt(self, payload, command): 
        self.aws.publish_prompt_user(payload, command)
    
    def stop(self):
        self._stop_event.set()

