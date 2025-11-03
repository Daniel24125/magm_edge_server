import time
import threading
from statistics import mean
from datetime import datetime
import sys, os
from typing import Callable

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../,,"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger
from shared.models.sensor_reading import SensorReading
from edge_server.database.db_manager import DatabaseHelper

class PHCalibrationManager:
    def __init__(self, mqtt_client, db: DatabaseHelper, device_id: str, read_ph_callback: Callable[[], SensorReading]):
        self.mqtt = mqtt_client
        self.db = db
        self.device_id = device_id
        self.read_ph = read_ph_callback  
        self.state = "idle"
        self.values = []
        self.acidic_value = None
        self.alkaline_value = None
        self._lock = threading.Lock()
        self.running = False

        # Calibration parameters
        self.stability_window = 10
        self.threshold = 0.02
        self.sample_rate = 1.0
        self.timeout = 120

    def start(self):
        if self.running:
            logger.warning("Calibration already running")
            return
        self.running = True
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        try:
            self._prompt_user("acidic", "Insert probe in pH 4.0 buffer")
            self.acidic_value = self._wait_for_stable()
            self._prompt_user("alkaline", "Insert probe in pH 7.0 buffer")
            self.alkaline_value = self._wait_for_stable()
            self._finalize()
        except Exception as e:
            logger.error(f"Calibration failed: {e}")
        finally:
            self.running = False

    def _prompt_user(self, phase, msg):
        topic = f"/devices/{self.device_id}/cal/{phase}"
        logger.info(f"📡 {msg}")
        self.mqtt.publish(topic, {"message": msg, "timestamp": datetime.utcnow().isoformat()})
        self.values.clear()
        time.sleep(2)

    def _wait_for_stable(self):
        start = time.time()
        while time.time() - start < self.timeout:
            read = self.read_ph()
            ph_avg = read.value
            is_stable = read.is_stable
            if is_stable:
                logger.info(f"✅ Stable pH detected: {ph_avg:.3f}")
                return ph_avg
            time.sleep(self.sample_rate)
        raise TimeoutError("Calibration timed out waiting for stability.")
    

    def _finalize(self):
        slope = (self.alkaline_value - self.acidic_value) / (7.0 - 4.0)
        intercept = self.alkaline_value - slope * 7.0
        logger.info(f"📈 Calibration complete: slope={slope:.4f}, intercept={intercept:.4f}")

        self.db.add_record("calibrations", {
            "timestamp": datetime.utcnow().isoformat(),
            "device_id": self.device_id,
            "sensor": "pH",
            "acidic_value": self.acidic_value,
            "alkaline_value": self.alkaline_value,
            "slope": slope,
            "intercept": intercept,
            "status": "success"
        })

        topic = f"/devices/{self.device_id}/cal/complete"
        self.mqtt.publish(topic, {
            "status": "success",
            "slope": slope,
            "intercept": intercept
        })

        logger.info("🎯 pH calibration finished successfully.")
