import os, sys
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.utils.logger import logger
from edge_server.models.schemas import CommandPayload


class CommandHandler:
    """Responsible for parsing commands and dispatching them to the controller."""

    def __init__(self, controller):
        self.controller = controller

    def handle_ui_command(self, payload: dict):
        try:
            cmd = CommandPayload(**payload)
            print(payload)
        except Exception as e:
            logger.error(f"Invalid command payload: {payload} ({e})")
            return

        match cmd.command:
            case "configure_session":
                self.controller._handle_config_update(cmd.params)
            case "start_session":
                self.controller.start_session(cmd.params)
            case "stop_session":
                self.controller.stop_session()
            case _:
                logger.warning(f"Unhandled UI command: {cmd.command}")

    def handle_device_message(self, topic: str, payload: dict):
        if not payload.get("device_id"):
            logger.error("Missing device_id in payload")
            return
        device_id = payload["device_id"]

        if topic.endswith("/status"):
            self.controller._handle_device_status(device_id, payload)
        elif topic.endswith("/data"):
            self.controller._handle_device_data(device_id, payload)
        elif topic.endswith("/register"):
            self.controller._handle_device_registration(device_id, payload)
        elif topic.endswith("/unregister"):
            self.controller._handle_device_disconnect(device_id, payload)