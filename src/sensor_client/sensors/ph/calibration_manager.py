import time
from datetime import datetime, timezone
import sys, os, threading
from typing import Callable
import json
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../,,"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger
from shared.models.sensor_reading import SensorReading
from edge_server.database.db_manager import DatabaseHelper


class PHCalibrationHelper:
    STANDARDS = {"acidic": 4.0, "neutral": 7.0, "alkaline": 10.0}

    @staticmethod
    def detect_standard(ph_value: float, tolerance: float = 0.5) -> str:
        """Infer which pH standard is being measured."""
        if ph_value is None:
            return "unknown"
        diffs = {name: abs(ph_value - ref) for name, ref in PHCalibrationHelper.STANDARDS.items()}
        name, delta = min(diffs.items(), key=lambda kv: kv[1])
        return name if delta <= tolerance else "unknown"
    

class PHCalibrationManager:

    def __init__(self, mqtt_client, db: DatabaseHelper, read_ph_callback: Callable[[], SensorReading], payload: dict):
        self.mqtt = mqtt_client
        self.db = db

        self.device_id = payload.get("device_id")
        self.sensor_id = payload.get("sensor_id")
        self.user = payload.get("user_name", "")
        self.read_ph = read_ph_callback  
        self.reset_calibration()

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
        # TODO: AUTO DETECT BUFFER SO THAT THE MEASUREMETN DOES NOT DEPEND ONLY ON THE STABILITY 
        self.running = True
        logger.info("Calibration process started")

        self._prompt_user("ACIDIC", "Waiting for the acidic buffer (pH 4.0) to stabilize...")
        self.register_measurement_value("acidic")
        self._prompt_user("ALKALINE", "Waiting for the alkaline buffer (pH 7.0) to stabilize...")
        self.register_measurement_value("alkaline")


    def register_measurement_value(self, measurement_type: str): 
        time.sleep(2)
        is_buffer_ready = True

        if measurement_type == "acidic":
            if is_buffer_ready:
                self.acidic_value = self._wait_for_stable()
        elif measurement_type == "alkaline":
            if is_buffer_ready:
                self.alkaline_value = self._wait_for_stable()
                self._finalize()
        else: 
            raise ValueError("Incorrect measurement type chosen. Please choose between acidic or alkaline measurement")
    

    def _prompt_user(self, status, msg):
        topic = f"/devices/{self.device_id}/cal/prompt_user"
        logger.info(msg)
        payload = {
            "topic": topic,
            "payload": {
                "type": "calibration",
                "message": msg,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "device_id": self.device_id,
                "data":{
                    "device_status": status,
                }
            }
        }
        self.mqtt.publish(topic, json.dumps(payload))

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
        try:
            slope = (self.alkaline_value - self.acidic_value) / (7.0 - 4.0)
            intercept = self.alkaline_value - slope * 7.0
            logger.info(f"Calibration complete: slope={slope:.4f}, intercept={intercept:.4f}")
            
            self.save_cal_into_db(slope, intercept)
            self._prompt_user("READY", "pH calibration finished successfully.")
            logger.info("pH calibration finished successfully.")

        except Exception as e: 
            logger.error(f"An error occured trying to finalize the calibration process: {e}")
        finally:
            self.reset_calibration()

    def save_cal_into_db(self, slope: float, intercept: float): 
        self.db.add_record("ph_calibration", {
            "date": datetime.now(timezone.utc).isoformat(),
            "device_id": self.device_id,
            "sensor_id": self.sensor_id,
            "sensor_type": "pH",
            "slope": slope,
            "intercept": intercept,
            "operator": self.user,
            "calibration_temp": 25
        })

    def reset_calibration(self): 
        self.acidic_value = None
        self.alkaline_value = None
        self.running = False

