import time
from datetime import datetime, timezone
import sys, os, threading
from typing import Callable, Dict
import json
import numpy as np
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../,,"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger
from shared.models.sensor_reading import SensorReading
from edge_server.database.db_manager import DatabaseHelper


class PHCalibrationHelper:
    STANDARDS = {"acidic": 4.0, "neutral": 7.0, "alkaline": 9.0}

    @staticmethod
    def detect_standard(ph_value: float, tolerance: float = 0.5) -> str:
        """Infer which pH standard is being measured."""
        if ph_value is None:
            return "unknown"
        diffs = {name: abs(ph_value - ref) for name, ref in PHCalibrationHelper.STANDARDS.items()}
        name, delta = min(diffs.items(), key=lambda kv: kv[1])
        return name if delta <= tolerance else "unknown"
    

class PHCalibrationManager:


    def __init__(self, mqtt_client, db: DatabaseHelper, read_ph_callback: Callable[[], SensorReading], read_raw_callback: Callable[[], float], payload: dict):
        self.mqtt = mqtt_client
        self.db = db 
        self.read_ph = read_ph_callback
        self.read_raw = read_raw_callback

        self.device_id = payload.get("device_id")
        self.sensor_id = payload.get("sensor_id")
        self.user = payload.get("user_name", "unknown")

         # --- Calibration control variables ---
        self.running = False
        self.calibration_data: Dict[str, float] = {}
        self.sample_rate = 1.0
        self.timeout = 18000
        self.stability_min_count = 3
        self.detection_tolerance = 0.5
        self.publish_live_interval = 1.0

        # --- Temporary slope/intercept before confirmation ---
        self.slope = None
        self.intercept = None

    def start(self):
        if self.running:
            logger.warning("Calibration already running")
            return
        self.running = True
        threading.Thread(target=self._run, daemon=True).start()
        threading.Thread(target=self._broadcast_live_readings, daemon=True).start()

    def reset_calibration(self):
        """Cancel calibration gracefully."""
        if not self.running:
            logger.info("Calibration not active, nothing to reset.")
            return
        self.running = False
        self.calibration_data.clear()
        self._notify_user("READY", "pH calibration was cancelled by the user.")
        logger.info("Calibration cancelled by user.")

    def finalize_from_user(self):
        """Commit pending calibration results to DB after UI confirmation."""
        try:
            if not self.slope or not self.intercept:
                logger.warning("No computed calibration to finalize.")
                return
            self.save_cal_into_db()
           
            self._notify_user("CONFIRM", "Calibration confirmed and saved successfully.")
            logger.info("Calibration confirmed by user and stored.")
            self.running = False
        except Exception as e:
            logger.error(f"Failed to finalize calibration: {e}")
            self._notify_user("ERROR", f"Failed to store calibration: {e}")


    # ---------- Internal Methods ----------
    def _run(self):
        logger.info("Starting automatic pH calibration.")
        self._notify_user("START", "Place the probe in the first buffer (pH 4, 7, or 10).")

        start_time = time.time()
        last_detected, stable_counter = None, 0

        while self.running and (time.time() - start_time < self.timeout):
            try:
                reading = self.read_ph()
                if not reading:
                    time.sleep(self.sample_rate)
                    continue
                ph_val, is_stable = reading.value, reading.is_stable
                detected = PHCalibrationHelper.detect_standard(ph_val, self.detection_tolerance)
                logger.info(f"detected: {detected}")

                if detected != "unknown" and is_stable:
                    if detected == last_detected:
                        stable_counter += 1
                    else:
                        stable_counter, last_detected = 1, detected

                    if stable_counter >= self.stability_min_count and detected not in self.calibration_data:
                        self._register_standard(detected, ph_val)
                        if len(self.calibration_data) >= 3:
                            break
                        self._notify_user(
                            "NEXT",
                            f"{detected.capitalize()} buffer registered. Move to next standard."
                        )
                        stable_counter, last_detected = 0, None
                else:
                    stable_counter = 0
                    if detected == "unknown":
                        last_detected = None

                time.sleep(self.sample_rate)
            except Exception as e:
                logger.error(f"Error during calibration loop: {e}")
                self._notify_user("ERROR", f"Calibration loop error: {e}")
                self.running = False
                return

        if len(self.calibration_data) >= 3 and self.running:
            self._compute_pending_results()
        #elif self.running:
            #self._notify_user("ERROR", "Calibration incomplete: insufficient stable standards.")
        self.running = False


    def _register_standard(self, name: str, value: float):
        raw_val = self.read_raw()
        self.calibration_data[name] = raw_val
        logger.info(f"✅ Registered {name} buffer at {value:.2f} pH (raw: {raw_val:.2f})")
        self._notify_user("STABLE", f"Stable {name} buffer detected ({value:.2f}).")

    def _compute_pending_results(self):
        try:
            # Prepare data for regression
            raw_values = []
            standard_ph_values = []
            
            for name, raw_val in self.calibration_data.items():
                if name in PHCalibrationHelper.STANDARDS:
                    raw_values.append(raw_val)
                    standard_ph_values.append(PHCalibrationHelper.STANDARDS[name])
            
            if len(raw_values) < 2:
                raise ValueError("Insufficient calibration points for regression")

            # Perform linear regression to find slope (m) and intercept (b)
            # We want raw * m + b = pH  => pH = m * raw + b
            # numpy.polyfit(x, y, deg) returns [slope, intercept]
            slope, intercept = np.polyfit(raw_values, standard_ph_values, 1)
            
            self.slope = slope
            self.intercept = intercept

            logger.info(
                f"Calibration computed with {len(raw_values)} points: "
                f"slope={self.slope:.5e}, intercept={self.intercept:.5f}"
            )
            self._notify_user(
                "COMPLETE",
                f"Calibration ready. slope={self.slope:.4e}, intercept={self.intercept:.4f}. Awaiting user confirmation."
            )
        except Exception as e:
            logger.error(f"Failed computing calibration: {e}")
            self._notify_user("ERROR", f"Computation failed: {e}")

    def _broadcast_live_readings(self):
        while self.running:
            try:
                r = self.read_ph()
                if not r:
                    time.sleep(self.publish_live_interval)
                    continue
                topic = f"/devices/{self.device_id}/cal/live_readings"
                is_stable = bool(r.is_stable)
                payload = {
                    "ph_value": r.value,
                    "is_stable": is_stable,
                    "stability_index": 1.0 if is_stable else 0.5,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                self._send_message_to_user(topic, payload)
            except Exception as e:
                logger.debug(f"Live broadcast error: {e}")
            time.sleep(self.publish_live_interval)
  
    def _notify_user(self, status: str, message: str):
        """Notify UI through AWS IoT via edge bridge."""
        topic = f"/devices/{self.device_id}/cal/prompt_user"
        payload = {
            "topic": topic,
            "payload": {
                "type": "calibration",
                "status": status,
                "message": message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": {"calibration_data": self.calibration_data},
            },
        }
        logger.info(f"[CAL] {status}: {message}")
        self._send_message_to_user(topic, payload)

    def _send_message_to_user(self, topic: str, payload: dict):
        try:
            if self.mqtt:
                self.mqtt.publish(topic, json.dumps({
                    "topic": topic,
                    "payload": {
                        **payload,
                        "device_id": self.device_id,
                        "sensor_id": self.sensor_id,
                        "source": "rpi"
                    }
                }), qos=1)
        except Exception as e:
            logger.error(f"MQTT publish failed: {e}")

    def save_cal_into_db(self): 
        self.db.add_record("ph_calibration", {
            "date": datetime.now(timezone.utc).isoformat(),
            "device_id": self.device_id,
            "sensor_id": self.sensor_id,
            "sensor_type": "pH",
            "slope": self.slope,
            "intercept": self.intercept,
            "operator": self.user,
            "calibration_temp": 25,
        })



