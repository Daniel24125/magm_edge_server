import sys, os, json, time
from datetime import datetime, timezone
from typing import Dict, Any

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.utils.logger import logger

class DeviceController:

    def __init__(self, client, alert_manager=None):
        self.client = client
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
        logger.debug(f"Data received from device '{device_name}'")
        
    def _notify_user(self, event, message, severity="info"):
        # We no longer inject 'devices_online' here, as the UI should subscribe to 'ui/devices/update'
        if self.alert_manager:
            self.alert_manager.send_system_alert(event, message, severity=severity)
        else:
            # self.aws._notify_user(event, message)
            payload = {
                "type": "app",
                "source": "edge",
                "event": event,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": message,
                "severity": "info"
            }
            self.client.publish("system/notifications", payload)

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
        start_time = time.time()
        timeout = 10 # 10 seconds timeout for startup race conditions
        
        while time.time() - start_time < timeout:
            try:
                self.client.publish(topic, json.dumps(payload), retain=True)
                return
            except Exception as e:
                logger.warning(f"Device update broadcast failed (AWS offline?). Retrying in 1s... ({int(timeout - (time.time() - start_time))}s left)")
                time.sleep(1)
        
        logger.error(f"Failed to broadcast device update for {device_id} after {timeout}s. Update might not reach UI.")

   
    def broadcast_all_devices(self):
        """Re-broadcasts the status of all currently connected devices."""
        logger.info(f"Broadcasting status for {len(self.online_devices)} devices.")
        for device_id, payload in self.online_devices.items():
            # If payload is just True (legacy/simple status), we might skip or handle differently.
            # But recent changes ensure payload is the registration dict.
            if isinstance(payload, dict):
               self._broadcast_device_update(device_id, "connected", payload)

    def forward_device_command(self , payload, cmd): 
        
        device_id = payload.get("device_id", "")
        topic = f"devices/{device_id}/commands/{cmd}"
        self.client.publish(
            topic,
            json.dumps(payload),
            qos=1
        )

    def _handle_user_prompt(self, payload, subtopic):
        device_id = payload.get("device_id", "")
        # Forward to AWS (future):
        # self.client.publish(f"devices/{device_id}/{subtopic}", json.dumps(payload))

    def _handle_device_event(self, device_id: str, payload: Dict[str, Any]):
        """
        Handles explicit events from devices, such as pump activations.
        These are device-level events, effectively independent of sessions.
        """
        event_type = payload.get("type")
        data = payload.get("payload", {}) # Inner payload from client

        if event_type == "pump_activated":
            pump_type = data.get("pump_type", "unknown")
            duration = data.get("duration", 0)
            
            logger.info(f"Received pump activation event: {pump_type} for {duration}s")
            
            # Since this is a device event, we use system alert. 
            # If a session is active, the alert manager could theoretically correlate it,
            # but for now we treat it as a system notification as per user request.
            self._notify_user(
                event="pump_activated",
                message=f"The {pump_type} pump was activated for {duration:.2f} seconds",
                severity="info"
            )

    def _get_online_status(self):
        return {d: True for d in self.online_devices.keys()}




