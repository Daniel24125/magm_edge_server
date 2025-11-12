import threading, time, os, sys, json
from datetime import datetime, timezone

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.utils.logger import logger


class HeartbeatService:
    def __init__(self, aws_client, status_callback, interval=30):
        self.aws = aws_client
        self.status_callback = status_callback
        self.interval = interval
        self.running = False

    def start(self):
        if self.running:
            return
        self.running = True
        threading.Thread(target=self._run, daemon=True).start()
        logger.info("Edge heartbeat service started.")

    def stop(self):
        self.running = False
        logger.info("Edge heartbeat service stopped.")

    def _run(self):
        while self.running:
            try:
                # Get current device status from the session controller
                device_status = self.controller._get_online_status()
                payload = {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "edge_id": self.controller.device_id if hasattr(self.controller, "device_id") else "edge_server",
                    "devices_online": device_status,
                    "status": "ONLINE"
                }

                topic = "system/device_status"
                self.aws.publish_heartbeat(topic, json.dumps(payload))
                logger.debug(f"Heartbeat published to AWS with {len(device_status)} devices.")
            except Exception as e:
                logger.error(f"Error in heartbeat service: {e}")
            time.sleep(self.interval)