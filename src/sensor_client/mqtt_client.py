import paho.mqtt.client as mqtt
import json,  sys, os
from config.config_manager import ConfigManager

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger
config_manager = ConfigManager()


class MQTTClient:
    def __init__(self, config, sensor_manager):
        self.init_variables(config)
        self.sensor_manager = sensor_manager
        self.client = mqtt.Client(
            client_id=self.device_id,
            clean_session=False,
            protocol=mqtt.MQTTv311,
            userdata=None,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2
        )
        self.init_mqtt_client()

    def init_variables(self, broker_config): 
        self.device_config = config_manager.get_config().get("device_config", {})
        self.device_id = self.device_config.get("device_id", "")
        self.broker = broker_config.get("mqtt", {}).get("broker", "localhost")
        self.port = broker_config.get("mqtt", {}).get("port", 1883)
        self.keepalive = broker_config.get("mqtt", {}).get("keepalive", 60)
        self.topic = f"/device/{self.device_id}/data"


    def init_mqtt_client(self):
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
            logger.info(f"Received message in topic {msg.topic} - {payload}")
            self.parse_message(msg.topic, payload)

        except json.JSONDecodeError:
            logger.error(f"Error decoding JSON payload: {msg.payload}")
        except Exception as e:
            logger.error(f"An error occurred while processing message: {e}")
    
    def parse_message(self, topic, payload):
        if topic == "/controller/status/session_config_updated": 
            config_manager.update_config(payload)
        elif topic == "/controller/commands/start": 
            logger.info("Starting session...")
            self.sensor_manager.start_acquisition_loop()

    def subscribe_to_topics(self):
        self.client.subscribe("/controller/retry")
        self.client.subscribe("/controller/status/session_config_updated")
        self.client.subscribe("/controller/commands/#")

    
    def register_device(self): 
        topic = f"/devices/{self.device_id}/register"
        payload = {
            "topic": topic,
            "payload": {
                "device_id": self.device_id,
                "status": "ONLINE"
            }
        }
        self.client.publish(topic, json.dumps(payload), qos=1)

    def unregister_device(self): 
        topic = f"/devices/{self.device_id}/unregister"
        payload = {
            "topic": topic,
            "payload": {
                "device_id": self.device_id,
                "status": "OFFLINE"
            }
        }
        self.client.publish(topic, json.dumps(payload), qos=1)

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

    def publish_sensor_data(self, readings: dict):
        payload = {
            "source": "rpi",
            "device_id": self.device_id,
            "data": {name: r.value if r else None for name, r in readings.items()}
        }
        message = json.dumps(payload)

        result = self.client.publish(self.topic, message, qos=1)
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            logger.warning(f"Failed to publish message: {mqtt.error_string(result.rc)}")
        else: 
            logger.info(f"Published sensor data to topic '{self.topic}': {message}")

    def stop(self):
        self.client.loop_stop()
        self.client.disconnect()