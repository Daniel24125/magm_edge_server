import threading
import json, sys, os, time
from utils.thread_handler import stop_event

# --- Configuration ---
# Since this script is in src/, we need the sys.path fix to find config/
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger
try:
    from shared.utils.config_loader import load_config
except ImportError as e:
    print(f"Configuration import failed. Please ensure the 'config' package is set up correctly. Error: {e}")
    sys.exit(1)

# Default to local broker if not explicitly configured
broker_config = load_config(os.path.join(PROJECT_ROOT, "shared/config/mqtt.json")).get("mqtt", {})
MQTT_HOST = broker_config.get("broker") 
MQTT_PORT = broker_config.get("port", 1883)
TOPICS_TO_SUBSCRIBE = broker_config.get('topics', "/#")


# --- Dependency: paho-mqtt ---
try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("ERROR: paho-mqtt library not found.")
    print("Please install it using: pip install paho-mqtt")
    sys.exit(1)


class MqttSubscriber(threading.Thread):
    """
    Manages the connection to the MQTT broker and subscribes to all sensor topics.
    """
    def __init__(self, data_queue):
        super().__init__(daemon=True)
        self.data_queue = data_queue
        self.init_variables()

    def init_variables(self):
        self.host = MQTT_HOST
        self.port = MQTT_PORT
        self.topic = TOPICS_TO_SUBSCRIBE
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        logger.info(f"MQTT Subscriber initialized for: {self.host}:{self.port}")

    def _on_connect(self, client, userdata, flags, rc, properties): 
        """Callback function for when the client receives a CONNACK response from the server."""
        if rc == 0:
            # Subscribe to the topic with QoS 1
            # client.subscribe(self.topic, qos=1)
            for topic in TOPICS_TO_SUBSCRIBE: 
                logger.info(f"Successfully connected to MQTT broker. Subscribing to '{topic}'...")
                client.subscribe(topic, qos=1)
        else:
            logger.error(f"Connection failed with code {rc}. Please ensure your local broker is running.")
            
    def _on_message(self, client, userdata, msg):
        """Callback function for when a PUBLISH message is received from the server."""
        try:
            logger.info(f"Received message in topic {msg.topic}")
            payload = json.loads(msg.payload.decode())
            data_to_send = {
                **payload,
                "topic": msg.topic
            }
            self.data_queue.put(data_to_send)
            # self.display_payload(payload, msg)
            
        except json.JSONDecodeError:
            logger.error(f"Error decoding JSON payload: {msg.payload.decode()}")
        except Exception as e:
            logger.error(f"An error occurred while processing message: {e}")

    def display_payload(self, payload, msg):
        # Format and print the received data
        data = payload.get("data", {})
        for name, reading in data.items():
            print("-" * 50)
            print(f"[{time.strftime('%H:%M:%S', time.localtime(payload.get('timestamp')))}] NEW READING FROM {payload.get("source")}")
            print(f"  Topic: {msg.topic}")
            print(f"  Sensor: {name}")
            print(f"  Value: {reading}")
            print("-" * 50)

    def run(self):
        """Starts the MQTT client loop."""
        try:
            self.client.connect(self.host, self.port, keepalive=60)
            self.client.loop_start()
            while not stop_event.is_set():
                time.sleep(1)
            self.stop_process()
        except KeyboardInterrupt:
            logger.warning("\nShutting down subscriber.")
        except Exception as e:
            logger.error(f"An error occurred: {e}")
        finally:
            logger.info("Disconnecting server...")
            self.stop_process()

    def stop_process(self): 
        logger.info("MQTT thread stopping...")
        self.client.loop_stop()
        self.client.disconnect()
        logger.info("MQTT disconnected cleanly.")