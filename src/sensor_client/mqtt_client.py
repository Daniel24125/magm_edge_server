import paho.mqtt.client as mqtt
import json,  sys, os
from config.config_manager import ConfigManager
import time 
from sensors.manager import SensorManager
from sensors.ph.calibration_manager import PHCalibrationManager

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger
from edge_server.database.db_manager import DatabaseHelper

config_manager = ConfigManager()


class MQTTClient:

    def __init__(self, config: dict, sensor_manager: SensorManager):
        self.sensor_manager = sensor_manager
        self.init_variables(config)
        self.define_publish_topics()
        self.init_mqtt_client()

    def init_variables(self, broker_config): 
        self.device_config = config_manager.get_config().get("device_config", {})
        self.device_id = self.device_config.get("device_id", "")
        self.device_name = self.device_config.get("device_name", "")
        self.broker = broker_config.get("mqtt", {}).get("broker", "localhost")
        self.port = broker_config.get("mqtt", {}).get("port", 1883)
        self.keepalive = broker_config.get("mqtt", {}).get("keepalive", 60)
        self.ph_calibration = None
        self.db =  DatabaseHelper("src/edge_server/database/models/sessions.db")

    def define_publish_topics(self): 
        self.publish_measurement_topic = f"/devices/{self.device_id}/data"
        self.device_registration_topic = f"/devices/{self.device_id}/register"
        self.device_unregistration_topic = f"/devices/{self.device_id}/unregister"
        self.device_request_acidic = f"/devices/{self.device_id}/cal/acidic"
        self.device_request_alkaline = f"/devices/{self.device_id}/cal/alkaline"

    def subscribe_to_topics(self):
        self.client.subscribe("/controller/retry")
        self.client.subscribe("/controller/status/session_config_updated")
        self.client.subscribe("/controller/commands/#")
        self.client.subscribe(f"/devices/{self.device_id}/commands/#")
        self.client.subscribe("/devices/registration_request")
        self.client.subscribe(f"/devices/{self.device_id}/cal/confirm")
        self.client.subscribe(f"/devices/{self.device_id}/cal/cancel")

    def init_mqtt_client(self):
        self.client = mqtt.Client(
            client_id=self.device_id,
            clean_session=False,
            protocol=mqtt.MQTTv311,
            userdata=None,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2
        )
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message
        self.client.reconnect_delay_set(min_delay=1, max_delay=self.keepalive)

    def on_connect(self, client, userdata, flags, reason_code, properties):
        logger.info(f"Connected to MQTT broker at {self.broker}:{self.port}")
        if reason_code != 0:
            msg =f"Failed to connect (reason={reason_code})"
            logger.error(msg)
            raise Exception(msg)
        self.register_device()
        self.subscribe_to_topics()


    def on_message(self, client, userdata, msg): 
        try:
            payload = json.loads(msg.payload.decode())
            logger.info(f"Received message in topic {msg.topic}")
            self.parse_message(msg.topic, payload)

        except json.JSONDecodeError:
            logger.error(f"Error decoding JSON payload: {msg.payload}")
        except Exception as e:
            logger.error(f"An error occurred while processing message: {e}")
    
    def parse_message(self, topic, payload):
        logger.info(f"\nParsing Message from topic: {topic} - Payload: {payload}\n")
        if topic == "/controller/status/session_config_updated": 
            config_manager.update_config(payload)
        elif topic == "/controller/commands/start": 
            self.start_session(payload)
        elif topic.startswith(f"/controller/session/"):
            self.parse_session_commands(topic, payload)
        elif topic.startswith("/devices"): 
            self.parse_device_commands(topic, payload)
  
    def parse_session_commands(self, topic, payload):
        if topic.endswith("/measurement"):
            all_readings = self.sensor_manager.read_all_sensors()
            self.publish_sensor_data(all_readings, session_id=payload.get("id", ""))

    def parse_device_commands(self, topic, payload): 
        logger.info("\nParsing a device command:\n")
        if topic.endswith("registration_request"):
            self.register_device()
        elif topic.endswith("start_calibration"):
            self.calibrate_device(payload)
        elif topic.endswith("register_cal_measurement"):
            if getattr(self, "ph_calibration"):
                self.ph_calibration.register_measurement_value(payload.get("measurement_type"))
        elif topic.endswith("cal/cancel"):
            if getattr(self, "ph_calibration"):
                self.ph_calibration.reset_calibration()
                self.ph_calibration = None
        elif topic.endswith("cal/confirm"):
            if getattr(self, "ph_calibration"):
                self.ph_calibration.finalize_from_user()
        elif topic.endswith("pump_control"):
            # Payload: { sensor_id, pump_type, duration }
            sensor_id = payload.get("sensor_id")
            pump_type = payload.get("pump_type")
            try:
                duration = float(payload.get("duration", 1.0))
            except:
                duration = 1.0
                
            sensor = self.sensor_manager.get_sensor(sensor_id)
            if sensor and hasattr(sensor, "test_pump"):
                sensor.test_pump(pump_type, duration)
            else:
                logger.warning(f"Sensor {sensor_id} does not support pump control")
    
    def calibrate_device(self, payload: dict):
        logger.info("Starting device calibration...")
        sensor_id =payload.get("sensor_id", "")
        sensor = self.sensor_manager.get_sensor(sensor_id=sensor_id)
        self.ph_calibration = PHCalibrationManager(self.client, self.db, sensor.read, payload)
        self.ph_calibration.start()

    def start_session(self, payload: str):
        session_id = payload.get("id")
        logger.info(f"Starting session with ID: {session_id}")
        self.client.subscribe(f"/controller/session/{session_id}/#")

    def register_device(self): 
        payload = {
            "topic": self.device_registration_topic,
            "payload": {
                "device_id": self.device_id,
                "device_name": self.device_name,
                "status": "ONLINE",
                "sensors": self.sensor_manager.get_sensor_config()
            }
        }
        self.client.publish(self.device_registration_topic, json.dumps(payload), qos=1)
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
        self.client.publish(self.device_unregistration_topic, json.dumps(payload), qos=1)

    def on_disconnect(self, client, userdata, rc):
        logger.warning("Disconnected from MQTT broker")

    def connect(self):
        try: 
            self.client.connect(self.broker, self.port, self.keepalive)
            self.client.loop_forever()
        except Exception as err: 
            self.unregister_device()
            logger.error(f"The connection failed: {err}")
        except KeyboardInterrupt: 
            self.unregister_device()
            logger.error("The connection was interruped by the user")

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

        result = self.client.publish(self.publish_measurement_topic, message, qos=1)
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            logger.warning(f"Failed to publish message: {mqtt.error_string(result.rc)}")
        else: 
            logger.info(f"Published sensor data to topic '{self.publish_measurement_topic}': {message}")

    def stop(self):
        self.client.loop_stop()
        self.client.disconnect()