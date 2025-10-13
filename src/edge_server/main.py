import json
import sys
import os
import time

# --- Dependency: paho-mqtt ---
try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("ERROR: paho-mqtt library not found.")
    print("Please install it using: pip install paho-mqtt")
    sys.exit(1)


# --- Configuration ---
# Since this script is in src/, we need the sys.path fix to find config/
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    from shared.utils.config_loader import load_config
except ImportError as e:
    print(f"Configuration import failed. Please ensure the 'config' package is set up correctly. Error: {e}")
    sys.exit(1)

# Default to local broker if not explicitly configured
broker_config = load_config(os.path.join(PROJECT_ROOT, "shared/config/mqtt.json")).get("mqtt", {})
MQTT_HOST = broker_config.get("broker") 
MQTT_PORT = broker_config.get("port", 1883)
TOPIC_TO_SUBSCRIBE = f"{broker_config.get('topic_sensors', "/#")}"


class MqttSubscriber:
    """
    Manages the connection to the MQTT broker and subscribes to all sensor topics.
    """
    def __init__(self, host: str, port: int, topic: str):
        self.host = host
        self.port = port
        self.topic = topic
        
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        
        print(f"MQTT Subscriber initialized for: {host}:{port}")

    def _on_connect(self, client, userdata, flags, rc, properties): 
        """Callback function for when the client receives a CONNACK response from the server."""
        if rc == 0:
            print(f"Successfully connected to MQTT broker. Subscribing to '{self.topic}'...")
            # Subscribe to the topic with QoS 1
            client.subscribe(self.topic, qos=1)
        else:
            print(f"Connection failed with code {rc}. Please ensure your local broker is running.")
            
    def _on_message(self, client, userdata, msg):
        """Callback function for when a PUBLISH message is received from the server."""
        try:
            payload = json.loads(msg.payload.decode())
            
            # Format and print the received data
            print("-" * 50)
            print(f"[{time.strftime('%H:%M:%S', time.localtime(payload.get('timestamp')))}] NEW READING")
            print(f"  Topic: {msg.topic}")
            print(f"  Sensor: {payload.get('sensor_name', 'N/A')}")
            print(f"  Value: {payload.get('value')} {payload.get('unit', '')}")
            print("-" * 50)
            
        except json.JSONDecodeError:
            print(f"Error decoding JSON payload: {msg.payload.decode()}")
        except Exception as e:
            print(f"An error occurred while processing message: {e}")

    def run(self):
        """Starts the MQTT client loop."""
        try:
            self.client.connect(self.host, self.port, keepalive=60)
            # Blocking call that processes network traffic, calls callbacks, and handles reconnections
            self.client.loop_forever()
        except KeyboardInterrupt:
            print("\nShutting down subscriber.")
        except Exception as e:
            print(f"An error occurred: {e}")
        finally:
            self.client.disconnect()


if __name__ == "__main__":

    subscriber = MqttSubscriber(
        host=MQTT_HOST,
        port=MQTT_PORT,
        topic=TOPIC_TO_SUBSCRIBE
    )
    subscriber.run()