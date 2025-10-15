import ssl
import json
import threading
import os 
import sys
from typing import Dict, Any
import paho.mqtt.client as mqtt
from dotenv import load_dotenv
from utils.thread_handler import stop_event

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env.local"))
AWS_ENDPOINT = os.getenv('AWS_ENDPOINT')
AWS_CERTIFICATE = os.getenv('AWS_CERTIFICATE')
AWS_KEY = os.getenv('AWS_KEY')
AWS_ROOT_CERT = os.getenv('AWS_ROOT_CERT')
AWS_PORT = os.getenv('AWS_PORT')
AWS_CLIENT_ID = os.getenv('AWS_CLIENT_ID')

FILE_ROOT = os.path.dirname(os.path.abspath(__file__))
CERT_DIR = os.path.join(FILE_ROOT, "certs")

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.utils.logger import logger
from shared.utils.state_manager import StateManager
state_manager = StateManager()

class AWSIoTClient(threading.Thread):
    def __init__(self, data_queue, topic: dict):
        super().__init__(daemon=True)
        self.data_queue = data_queue
        self.endpoint = AWS_ENDPOINT
        self.port = int(AWS_PORT)
        self.root_ca = os.path.join(CERT_DIR,AWS_ROOT_CERT)
        self.certfile = os.path.join(CERT_DIR,AWS_CERTIFICATE)
        self.keyfile = os.path.join(CERT_DIR,AWS_KEY)
        self.client_id = AWS_CLIENT_ID
        self.topic = topic
        self.client = mqtt.Client(client_id=self.client_id)
        self._configure_tls()
        self._register_callbacks()

    def _configure_tls(self):
        """Configure TLS mutual authentication for AWS IoT"""
        self.client.tls_set(
            ca_certs=self.root_ca,
            certfile=self.certfile,
            keyfile=self.keyfile,
            cert_reqs=ssl.CERT_REQUIRED,
            tls_version=ssl.PROTOCOL_TLSv1_2
        )
        self.client.tls_insecure_set(False)

    def _register_callbacks(self):
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message

    # --- Callbacks ---
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info("Connected to AWS IoT Core")
            state_manager.update_aws_status(True)
        else:
            logger.error(f"Connection failed with code {rc}")
            state_manager.update_aws_status(False)

    def on_disconnect(self, client, userdata, rc):
        logger.warning("Disconnected from AWS IoT Core")
        state_manager.update_aws_status(False)

    def on_message(self, client, userdata, msg):
        logger.info(f"Received message on {msg.topic}: {msg.payload.decode()}")

    # --- Main API ---
    def connect(self):
        logger.info(f"Connecting to AWS IoT at {self.endpoint}:{self.port}")
        self.client.connect(self.endpoint, self.port, keepalive=60)
        # self.client.loop_start()
        self.listen()

    def disconnect(self):
        logger.info("Disconnecting from AWS IoT Core")
        self.client.loop_stop()
        self.client.disconnect()

    def publish_sensor_data(self, payload: Dict[str, Any]):
        """
        Publish sensor or aggregated data to IoT Core.
        """
        message = json.dumps(payload)
        logger.debug(f"Publishing to {self.topic}: {message}")
        self.client.publish(self.topic, message, qos=1)

    def listen(self): 
        logger.info("Listenning for sensor data...")
        while not stop_event.is_set():
            try:
                # Wait for data from MQTT
                data = self.data_queue.get(timeout=1)
                logger.debug(type(data))
                self.publish_sensor_data(data)
            except Exception:
                continue
        print("TESTE")
