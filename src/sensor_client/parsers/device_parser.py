import json
import os
import sys
from shared.utils.logger import logger
from edge_server.database.db_manager import DatabaseHelper
from sensors.ph.calibration_manager import PHCalibrationManager

class DeviceCommandParser:
    def __init__(self, mqtt_client_wrapper, sensor_manager, device_config):
        self.client_wrapper = mqtt_client_wrapper # The MQTTClient instance or the paho client? The wrapper has helper methods maybe? 
        # Actually in the original code, self.client is paho client. 
        # But we need access to 'publish' which is on the paho client.
        # And we need to subscribe logic which is on paho client.
        
        self.mqtt_client = mqtt_client_wrapper.client # Access the underlying paho client
        self.sensor_manager = sensor_manager
        self.device_config = device_config
        self.device_id = self.device_config.get("device_id", "")
        self.device_name = self.device_config.get("device_name", "")
        
        self.device_registration_topic = f"/devices/{self.device_id}/register"
        self.device_unregistration_topic = f"/devices/{self.device_id}/unregister"
        
        self.ph_calibration = None
        # Using the relative path as in original code, assuming running from correct cwd or path setup
        self.db = DatabaseHelper("src/edge_server/database/models/sessions.db") 

    def parse(self, topic, payload):
        if topic.endswith("registration_request"):
            self.register_device()
        elif topic.endswith("start_calibration"):
            self.calibrate_device(payload)
        elif topic.endswith("register_cal_measurement"):
            if self.ph_calibration:
                self.ph_calibration.register_measurement_value(payload.get("measurement_type"))
        elif topic.endswith("cal/cancel"):
            if self.ph_calibration:
                self.ph_calibration.reset_calibration()
                self.ph_calibration = None
        elif topic.endswith("cal/confirm"):
            if self.ph_calibration:
                self.ph_calibration.finalize_from_user()
        elif topic.endswith("pump_control"):
            self._handle_pump_control(payload)

    def _handle_pump_control(self, payload):
        # Payload: { sensor_id (optional), pump_type, duration }
        sensor_id = payload.get("sensor_id")
        pump_type = payload.get("pump_type") or payload.get("pump") 
        
        try:
            duration = float(payload.get("duration", 1.0))
        except:
            duration = 1.0
        
        sensor = None
        if sensor_id:
            sensor = self.sensor_manager.get_sensor(sensor_id)
        else:
            for s in self.sensor_manager.sensors:
                if hasattr(s, "test_pump"):
                    sensor = s
                    break
        
        if sensor and hasattr(sensor, "test_pump"):
            sensor.test_pump(pump_type, duration)
        else:
            logger.warning(f"No sensor found that supports pump control (ID: {sensor_id})")

    def calibrate_device(self, payload: dict):
        logger.info("Starting device calibration...")
        sensor_id = payload.get("sensor_id", "")
        sensor = self.sensor_manager.get_sensor(sensor_id=sensor_id)
        # We need to pass the mqtt client (paho) to CalibrationManager as per original code
        self.ph_calibration = PHCalibrationManager(self.mqtt_client, self.db, sensor.read, sensor.get_last_raw_average, payload)
        self.ph_calibration.start()

    def register_device(self): 
        sensor_config = self.sensor_manager.get_sensor_config()
        
        # Inject last calibration date for pH sensors
        for sensor in sensor_config:
            if sensor.get("type") == "pH":
                try:
                    cal_data = self.db.get_last_calibration(sensor.get("type"))
                    if cal_data:
                        # cal_data: (sensor_id, slope, intercept, calibration_temp, date, id)
                        sensor["last_calibration_date"] = cal_data[4]
                except Exception as e:
                   logger.warning(f"Failed to fetch calibration data: {e}")

        payload = {
            "topic": self.device_registration_topic,
            "payload": {
            "device_id": self.device_id,
            "device_name": self.device_name,
            "status": "ONLINE",
                "sensors": sensor_config
            }
        }
        self.mqtt_client.publish(self.device_registration_topic, json.dumps(payload), qos=1)
        logger.info("Device registration sent")

    def unregister_device(self): 
        payload = {
            "topic": self.device_unregistration_topic,
            "payload": {
             "device_id": self.device_id,
             "device_name": self.device_name,
                "status": "OFFLINE"
            }
        }
        self.mqtt_client.publish(self.device_unregistration_topic, json.dumps(payload), qos=1)
