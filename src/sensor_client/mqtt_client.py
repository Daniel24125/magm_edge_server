import paho.mqtt.client as mqtt
import json,  sys, os
from config.config_manager import ConfigManager
import time 
from sensors.manager import SensorManager

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger
from parsers.device_parser import DeviceCommandParser
from parsers.session_parser import SessionCommandParser

config_manager = ConfigManager()

class MQTTClient:

    def __init__(self, config: dict, sensor_manager: SensorManager):
        self.sensor_manager = sensor_manager
        self.init_variables(config)
        self.init_mqtt_client()
        
        # Initialize parsers
        self.device_parser = DeviceCommandParser(self, self.sensor_manager, self.device_config)
        self.session_parser = SessionCommandParser(self, self.sensor_manager, config_manager)

    def init_variables(self, broker_config): 
        self.device_config = config_manager.get_config().get("device_config", {})
        self.device_id = self.device_config.get("device_id", "")
        self.device_name = self.device_config.get("device_name", "")
        self.broker = broker_config.get("mqtt", {}).get("broker", "localhost")
        self.port = broker_config.get("mqtt", {}).get("port", 1883)
        self.keepalive = broker_config.get("mqtt", {}).get("keepalive", 60)

    def subscribe_to_topics(self):
        self.client.subscribe("controller/retry")
        self.client.subscribe("controller/status/session_config_updated")
        self.client.subscribe("controller/commands/#")
        self.client.subscribe(f"devices/{self.device_id}/commands/#")
        self.client.subscribe("devices/registration_request")
        self.client.subscribe(f"devices/{self.device_id}/cal/confirm")
        self.client.subscribe(f"devices/{self.device_id}/cal/cancel")

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
        self.device_parser.register_device()
        self.subscribe_to_topics()

    def on_message(self, client, userdata, msg): 
        try:
            payload = json.loads(msg.payload.decode())
            logger.info(f"Received message in topic {msg.topic}")
            
            # Delegate parsing
            if msg.topic.startswith("devices"):
                self.device_parser.parse(msg.topic, payload)
            elif msg.topic.startswith("controller"):
                self.session_parser.parse(msg.topic, payload)

        except json.JSONDecodeError:
            logger.error(f"Error decoding JSON payload: {msg.payload}")
        except Exception as e:
            logger.error(f"An error occurred while processing message: {e}")
    
    def on_disconnect(self, client, userdata, flags, reason_code, properties):
        logger.warning(f"Disconnected from MQTT broker (rc={reason_code})")

    def connect(self):
        try: 
            self.client.connect(self.broker, self.port, self.keepalive)
            self.client.loop_forever()
        except Exception as err: 
            self.device_parser.unregister_device()
            logger.error(f"The connection failed: {err}")
        except KeyboardInterrupt: 
            self.device_parser.unregister_device()
            logger.error("The connection was interruped by the user")

    def stop(self):
        self.client.loop_stop()
        self.client.disconnect()

    def publish_event(self, event_type: str, payload: dict):
        """
        Publishes a device event to the edge server.
        """
        topic = f"devices/{self.device_id}/events"
        full_payload = {
            "topic": topic,
            "payload": {
                "device_id": self.device_id,
                "type": event_type,
                "timestamp": time.time(),
                "payload": payload
            }
        }
        self.client.publish(topic, json.dumps(full_payload), qos=1)
        logger.info(f"Published event {event_type} to {topic}")