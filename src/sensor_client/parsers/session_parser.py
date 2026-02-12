import json
import time
import paho.mqtt.client as mqtt
from shared.utils.logger import logger

class SessionCommandParser:
    def __init__(self, mqtt_client_wrapper, sensor_manager, config_manager):
        self.client_wrapper = mqtt_client_wrapper
        self.mqtt_client = mqtt_client_wrapper.client
        self.sensor_manager = sensor_manager
        self.config_manager = config_manager
        
        # We need device_id for publishing
        self.device_id = getattr(mqtt_client_wrapper, 'device_id', '')
        self.publish_measurement_topic = f"devices/{self.device_id}/data"

    def parse(self, topic, payload):
        if topic == "controller/status/session_config_updated": 
            self.config_manager.update_config(payload)
            self.sensor_manager.update_ph_config(payload)
        elif topic == "controller/commands/start": 
            self.start_session(payload)
        elif topic == "controller/commands/stop":
            self.stop_session(payload)
        elif topic == "controller/commands/pause":
            self.pause_session(payload)
        elif topic == "controller/commands/resume":
            self.resume_session(payload)
        elif "/measurement" in topic:
            self._handle_measurement_request(payload)

    def _handle_measurement_request(self, payload):
        all_readings = self.sensor_manager.read_all_sensors()
        self.publish_sensor_data(all_readings, session_id=payload.get("id", ""))

    def start_session(self, payload: dict):
        session_id = payload.get("id")
        logger.info(f"Starting session with ID: {session_id}")
        self.mqtt_client.subscribe(f"controller/session/{session_id}/#")
        # Notify Sensor Manager to start background tasks (e.g. pH control)
        self.sensor_manager.on_session_start(session_id)
        
        # Immediately publish initial readings
        self._handle_measurement_request(payload)

    def stop_session(self, payload: dict):
        logger.info("Stopping session...")
        self.sensor_manager.on_session_stop()

    def pause_session(self, payload: dict):
        logger.info("Pausing session...")
        self.sensor_manager.on_session_pause()

    def resume_session(self, payload: dict):
        logger.info("Resuming session...")
        self.sensor_manager.on_session_resume()

    def publish_sensor_data(self, readings: dict, session_id: str = None):
        payload = {
            "source": "rpi",
            "device_id": self.device_id,
            "id": session_id,
            "timestamp": time.time()*1000,
            "data": {name: {
                "value" : r.value,
                "timestamp": r.timestamp,
                "unit": r.unit,
                "is_stable": bool(r.is_stable),
                "sensor_type": r.sensor_type
            } if r else None for name, r in readings.items()}
        }
        message = json.dumps({
            "payload": payload, 
            "topic": self.publish_measurement_topic,
        })

        result = self.mqtt_client.publish(self.publish_measurement_topic, message, qos=1)
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            logger.warning(f"Failed to publish message: {mqtt.error_string(result.rc)}")
        else: 
            logger.info(f"Published sensor data to topic '{self.publish_measurement_topic}'")
