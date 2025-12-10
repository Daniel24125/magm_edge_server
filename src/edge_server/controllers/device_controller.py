import sys, os, json
from datetime import datetime, timezone

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.utils.logger import logger

class DeviceController:

    def __init__(self, mqtt, aws, alert_manager=None):
        self.mqtt = mqtt
        self.aws = aws
        self.alert_manager = alert_manager
        self.online_devices = {}

    # -------------------- Device Handling --------------------
    def _handle_device_registration(self, device_id, payload): 
        if device_id in self.online_devices: 
            logger.info(f"Device {device_id} is already registered")
            return 
        device_name = payload.get("device_name", "")
        self.online_devices[device_id] = payload
        logger.info(f"Device {device_id} registered")
        
        # 1. Send dedicated update to UI (replacing the data payload previously in notify_user)
        self._broadcast_device_update(device_id, "connected", payload)

        # 2. Send simple Toast notification
        self._notify_user("device_connected", f"Device '{device_name}' connected to the edge server.", severity="success")

    def _handle_device_disconnect(self, device_id, payload): 
        device_name = payload.get("device_name", "")
        self.online_devices.pop(device_id, None)
        logger.info(f"Device {device_id} unregistered")
        
        self._broadcast_device_update(device_id, "disconnected", {})
        self._notify_user("device_disconnected", f"Device '{device_name}' disconnected from the edge server.", severity="error")

    def _handle_device_status(self, device_id, payload): 
         self.online_devices[device_id] = True 

    def _handle_device_data(self, device_id, payload): 
        device_name = self.online_devices.get(device_id, {}).get("device_name", "")
        logger.info(f"Data received from device '{device_name}': {payload}") 
        self.aws.publish_sensor_data(payload)

    def _notify_user(self, event, message, severity="info"):
        # We no longer inject 'devices_online' here, as the UI should subscribe to 'ui/devices/update'
        if self.alert_manager:
            self.alert_manager.send_system_alert(event, message, severity=severity)
        else:
            self.aws._notify_user(event, message)

    def _broadcast_device_update(self, device_id, status, details):
        """
        Publishes device updates to a dedicated UI topic.
        Topic: ui/devices/update
        Payload: { type: 'device_update', device_id: ..., status: 'connected'|'disconnected', details: {...} }
        """
        payload = {
            "type": "device_update",
            "device_id": device_id,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": details 
        }
        topic = "ui/devices/update"
        self.aws.client.publish(topic, json.dumps(payload))

   
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

