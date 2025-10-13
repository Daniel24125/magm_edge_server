import paho.mqtt.client as mqtt
import json, time, sys, os

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger

class MQTTClient:
    def __init__(self, config):
        self.broker = config.get("mqtt", {}).get("broker", "localhost")
        self.port = config.get("mqtt", {}).get("port", 1883)
        self.topic = config.get("mqtt", {}).get("topic_sensors", "edge/sensors")
        self.client_id = config.get("mqtt", {}).get("client_id", "sensor_client_01")
        self.keepalive = config.get("mqtt", {}).get("keepalive", 60)
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=self.client_id, clean_session=False)
        self.client.connect(self.broker, self.port, self.keepalive)
        self.init_mqtt_client()

    def init_mqtt_client(self):
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.reconnect_delay_set(min_delay=1, max_delay=self.keepalive)

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info(f"Connected to MQTT broker at {self.broker}:{self.port}")
        else:
            logger.error(f"Failed to connect (rc={rc})")

    def on_disconnect(self, client, userdata, rc):
        logger.warning("Disconnected from MQTT broker")

    def connect(self):
        self.client.connect(self.broker, self.port, keepalive=self.keepalive)
        self.client.loop_start()

    def publish_sensor_data(self, readings: dict):
        payload = {
            "timestamp": time.time(),
            "data": {name: r.value if r else None for name, r in readings.items()}
        }
        message = json.dumps(payload)
        result = self.client.publish(self.topic, message, qos=1)
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            logger.warning(f"Failed to publish message: {mqtt.error_string(result.rc)}")

    def stop(self):
        self.client.loop_stop()
        self.client.disconnect()