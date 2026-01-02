import threading
import json
import sys
import os
import time
from typing import Dict, Any, Callable, Optional
import paho.mqtt.client as mqtt
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
    logger.error(f"Configuration import failed. Error: {e}")
    sys.exit(1)

# Default to local broker
broker_config = load_config(os.path.join(PROJECT_ROOT, "shared/config/mqtt.json")).get("mqtt", {})
MQTT_HOST = broker_config.get("broker", "localhost")
MQTT_PORT = broker_config.get("port", 1883)
# Subscribe to everything relevant
TOPICS_TO_SUBSCRIBE = broker_config.get("topics", [])

class EdgeMQTTClient(threading.Thread):
    """
    Unified MQTT Client for Edge Server.
    - Subscribes to sensor data.
    - Subscribes to UI commands.
    - Publishes updates to UI.
    """
    def __init__(self, data_queue):
        super().__init__(daemon=True)
        self.data_queue = data_queue
        self.client_id = f"edge_server_{int(time.time())}"
        self.host = MQTT_HOST
        self.port = MQTT_PORT
        
        self.client = mqtt.Client(
            client_id=self.client_id,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2
        )
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect
        
        # UI Command Callbacks
        self.on_command_callback: Optional[Callable] = None

        # Set Last Will and Testament (LWT)
        # This ensures that if the Edge Server disconnects, the broker publishes this message.
        lwt_payload = json.dumps({
            "type": "app",
            "source": "edge",
            "event": "rpi_disconnected",
            "message": "Edge Server Disconnected (LWT)"
        })
        self.client.will_set("system/notifications", payload=lwt_payload, qos=1, retain=True)

    def _on_connect(self, client, userdata, flags, rc, properties): 
        if rc == 0:
            logger.info(f"✅ Connected to Local MQTT Broker at {self.host}:{self.port}")
            for topic in TOPICS_TO_SUBSCRIBE: 
                logger.debug(f"Subscribing to '{topic}'...")
                client.subscribe(topic, qos=1)
            
            # Notify system
            self.publish("system/notifications", {
                "type": "app",
                "source": "edge",
                "event": "rpi_connected",
                "message": "The edge server is connected to local broker"
            }, retain=True)

            # Request all devices to register themselves (in case Edge restarted)
            self.publish("devices/registration_request", {}, retain=False)
            logger.info("Published 'devices/registration_request' to sync sensors.")
            logger.info(f"Published 'rpi_connected' notification to 'system/notifications'")
        else:
            logger.error(f"❌ Connection failed with code {rc}.")

    def _on_disconnect(self, client, userdata, flags, rc, properties):
        logger.warning(f"🔌 Disconnected from MQTT Broker (rc={rc})")

    def _on_message(self, client, userdata, msg):
        try:
            topic = msg.topic
            payload_str = msg.payload.decode()
            
            # 1. Handle UI Commands (previously via AWS)
            if topic.startswith("ui/commands/"):
                logger.info(f"Received UI Command on {topic}")
                # Put in queue with specific marking or handle directly?
                # The existing architecture puts everything in data_queue
                # But AWSIoTClient used to put it in data_queue too.
                # structure: {"topic": topic, "payload": json.loads(parsed_payload)}
                self.data_queue.put({
                    "topic": topic, 
                    "payload": json.loads(payload_str)
                })
                return

            # 2. Handle Sensor Data (previously MqttSubscriber)
            # data_to_send = { **payload, "topic": msg.topic }
            payload = json.loads(payload_str)
            data_to_send = {
                **payload,
                "topic": topic
            }
            self.data_queue.put(data_to_send)
            
        except json.JSONDecodeError:
            logger.error(f"Error decoding JSON payload on {msg.topic}")
        except Exception as e:
            logger.error(f"Error processing message on {msg.topic}: {e}")

    def publish(self, topic: str, payload: Any, qos=1, retain=False):
        """
        Publish message to MQTT broker.
        Payload can be dict (will be dumped to json) or string.
        """
        try:
            if isinstance(payload, (dict, list)):
                msg = json.dumps(payload)
            else:
                msg = str(payload)
            
            # logger.debug(f"Publishing to {topic}")
            self.client.publish(topic, msg, qos=qos, retain=retain)
        except Exception as e:
            logger.error(f"Failed to publish to {topic}: {e}")

    # Aliases to match AWSIoTClient/SessionController expectations if needed
    # But we will refactor SessionController to use .publish directly.

    def run(self):
        try:
            logger.info(f"Connecting to {self.host}...")
            self.client.connect(self.host, self.port, keepalive=60)
            self.client.loop_start()
            
            while not stop_event.is_set():
                time.sleep(1)
                
            self.stop_process()
        except Exception as e:
            logger.error(f"EdgeMQTTClient Error: {e}")
        finally:
            self.stop_process()

    def stop_process(self):
        logger.info("Stopping EdgeMQTTClient...")
        
        # Publish graceful disconnect message (overwriting the LWT or setting state)
        try:
            self.publish("system/notifications", {
                "type": "app",
                "source": "edge",
                "event": "rpi_disconnected",
                "message": "Edge Server Shutting Down"
            }, retain=True)
        except Exception as e:
            logger.warning(f"Failed to publish disconnect message: {e}")

        self.client.loop_stop()
        self.client.disconnect()
