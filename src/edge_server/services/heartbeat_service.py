import threading, time, os, sys
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
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, daemon=True)

    def start(self):
        logger.info("Heartbeat service started")
        self._stop.clear()
        self._thread.start()

    def stop(self):
        logger.info("Stopping heartbeat service...")
        self._stop.set()
        self._thread.join(timeout=3)

    def _loop(self):
        while not self._stop.is_set():
            status = self.status_callback()
            payload = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "online_devices": status,
                "summary": {
                    "total": len(status),
                    "online": sum(status.values()),
                    "offline": len(status) - sum(status.values())
                }
            }
            try:
                self.aws.publish_heartbeat(payload)
                logger.debug(f"Heartbeat sent: {payload}")
            except Exception as e:
                logger.error(f"Failed to publish heartbeat: {e}")
            time.sleep(self.interval)