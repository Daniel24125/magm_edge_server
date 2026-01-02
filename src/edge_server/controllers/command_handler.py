import os, sys, json
from datetime import datetime, timezone
from .session_controller import SessionController
from .device_controller import DeviceController

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.utils.logger import logger
from edge_server.models.schemas import CommandPayload


class CommandHandler:
    """Responsible for parsing commands and dispatching them to the controller."""

    def __init__(self, client, alert_manager=None):
        self.client = client
        self.device_controller = DeviceController(client, alert_manager)
        self.session_controller = SessionController(client, device_controller=self.device_controller)

    def handle_ui_command(self, payload: dict):
        if type(payload) == str:
            payload = json.loads(payload)
        try:
            cmd = CommandPayload(**payload)
        except Exception as e:
            logger.error(f"Invalid command payload: {payload} ({e})")
            return

        match cmd.command:
            case "configure_session":
                self.session_controller._handle_config_update(cmd.params)
            case "start_session":
                self.session_controller.start_session(cmd.params)
            case "ping_device":
                # self.aws._notify_user("rpi_connected", f"The edge server is connected")
                # Using alert manager would be cleaner but let's direct publish for now to match behavior
                self.client.publish("system/notifications", json.dumps({
                    "type": "app",
                    "source": "edge",
                    "event": "rpi_connected",
                    "timestamp": json.dumps(datetime.now(timezone.utc).isoformat()).strip('"'),
                    "message": "The edge server is connected"
                }))
                self.device_controller.broadcast_all_devices()
            case "stop_session":
                self.session_controller.stop_session()
            case "start_calibration":
                self.device_controller.forward_device_command(cmd.params, cmd.command)
            case "get_session_status":
                self.session_controller.publish_status()
            case "get_session_history":
                session_id = cmd.params.get("id") or self.session_controller.id
                if session_id:
                    self.session_controller.publish_history(session_id)
                else:
                    logger.warning("Received get_session_history with no ID and no active session.")
            case "pause_session":
                self.session_controller.pause_session()
            case "resume_session":
                self.session_controller.resume_session()
            case "confirm_calibration":
                device_id = cmd.params.get("device_id")
                topic = f"devices/{device_id}/cal/confirm"
                
                self.client.publish(topic, json.dumps(cmd.params))
            case "cancel_calibration":
                device_id = cmd.params.get("device_id")
                topic = f"devices/{device_id}/cal/cancel"
                self.client.publish(topic, json.dumps({
                   "topic": topic, 
                   "payload": {
                    **cmd.params,
                    "device_id": device_id
                   }
                }))
            case "pump_control":
                self.device_controller.forward_device_command(cmd.params, "pump_control")
            case _:
                logger.warning(f"Unhandled UI command: {cmd.command}")

    def handle_device_message(self, topic: str, payload: dict):
        if not payload.get("device_id"):
            logger.error(f"Missing device_id in payload: {payload}")
            return
        device_id = payload["device_id"]
        
        if topic.endswith("/status"):
            self.device_controller._handle_device_status(device_id, payload)
        elif topic.endswith("/data"):
            self.session_controller._handle_session_data(device_id, payload)
            self.device_controller._handle_device_data(device_id, payload)
        elif topic.endswith("/register"):
            self.device_controller._handle_device_registration(device_id, payload)
        elif topic.endswith("/unregister"):
            self.device_controller._handle_device_disconnect(device_id, payload)
        elif topic.endswith("/prompt_user"):
            self.device_controller._handle_user_prompt( payload, "cal/prompt_user")
        elif topic.endswith("/live_readings"):
            self.device_controller._handle_user_prompt(payload, "cal/live_readings")
        elif topic.endswith("/events"):
            self.session_controller._handle_device_event(device_id, payload)