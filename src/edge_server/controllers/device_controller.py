import sys, os, json
from datetime import datetime, timezone

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.utils.logger import logger

class DeviceController:

    def __init__(self, mqtt, aws):
        self.mqtt = mqtt
        self.aws = aws
        self.online_devices = {}

    # -------------------- Device Handling --------------------
    def _handle_device_registration(self, device_id, payload): 
        if device_id in self.online_devices: 
            logger.info(f"Device {device_id} is already registered")
            return 
        device_name = payload.get("device_name", "")
        self.online_devices[device_id] = payload
        logger.info(f"Device {device_id} registered")
        self._notify_user("device_connected", f"Device '{device_name}' connected to the edge server.")

    def _handle_device_disconnect(self, device_id, payload): 
        self.online_devices.pop(device_id, None)
        logger.info(f"Device {device_id} unregistered")
        self._notify_user("device_disconnected", f"Device '{device_name}' disconnected from the edge server.")

    def _handle_device_status(self, device_id, payload): 
         self.online_devices[device_id] = True 

    def _handle_device_data(self, device_id, payload): 
        device_name = self.online_devices.get(device_id, {}).get("device_name", "")
        logger.info(f"Data received from device '{device_name}': {payload}") 
        self.aws.publish_sensor_data(payload)

    def _notify_user(self, event, message):
        topic = "system/notifications"
        payload = {
            "type": "connection",
            "source": "edge",
            "event": event,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": message,
            "devices_online": list(self.online_devices.keys()),
        }
        try:
            self.aws.client.publish(topic, json.dumps(payload))
            logger.info(f"[NOTIFY] {event}: {message}")
        except Exception as e:
            logger.error(f"Failed to publish notification: {e}")
   
    def forward_device_command(self , payload, cmd): 
        
        device_id = payload.get("device_id", "")
        topic = f"/devices/{device_id}/commands/{cmd}"
        self.mqtt.client.publish(
            topic,
            json.dumps(payload),
            qos=1
        )

    def _get_online_status(self):
        return {d: True for d in self.online_devices.keys()}

