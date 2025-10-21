import paho.mqtt.client as mqtt
import json,  sys, os

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger
from shared.utils.config_loader import load_config

class MQTTClient:
    def __init__(self, config):
        self.init_variables(config)
        self.client = mqtt.Client(
            client_id=self.device_id,
            clean_session=False,
            protocol=mqtt.MQTTv311,
            userdata=None,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2
        )
        self.init_mqtt_client()

    def init_variables(self, broker_config): 
        self.device_config = load_config(os.path.join(os.path.dirname(__file__), "config/sensors.json")).get("device_config", {})
        self.device_id = self.device_config.get("device_id", "")
        self.broker = broker_config.get("mqtt", {}).get("broker", "localhost")
        self.port = broker_config.get("mqtt", {}).get("port", 1883)
        self.keepalive = broker_config.get("mqtt", {}).get("keepalive", 60)
        self.topic = f"/device/{self.device_id}/data"


    def init_mqtt_client(self):
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.reconnect_delay_set(min_delay=1, max_delay=self.keepalive)

    def on_connect(self, client, userdata, flags, reason_code, properties):

        logger.info(f"Connected to MQTT broker at {self.broker}:{self.port}")
        if reason_code != 0:
            msg =f"Failed to connect (reason={reason_code})"
            logger.error(msg)
            raise Exception(msg)
        self.subscribe_to_topics()


    def subscribe_to_topics(self):
       self.register_device()
       self.client.subscribe("/controller/retry")

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
            logger.info(f"Connecting to broker at {self.broker}:{self.port} ...")
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