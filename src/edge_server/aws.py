import ssl
import json
import time
import os 
import sys
from typing import Dict, Any
import paho.mqtt.client as mqtt
from dotenv import load_dotenv

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


class AWSIoTClient:
    def __init__(self, topic: dict):
        self.endpoint = AWS_ENDPOINT
        self.port = AWS_PORT
        self.root_ca = AWS_ROOT_CERT
        self.certfile = AWS_CERTIFICATE
        self.keyfile = AWS_KEY
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
        else:
            logger.error(f"Connection failed with code {rc}")

    def on_disconnect(self, client, userdata, rc):
        logger.warning("Disconnected from AWS IoT Core")

    def on_message(self, client, userdata, msg):
        logger.info(f"Received message on {msg.topic}: {msg.payload.decode()}")

    # --- Main API ---
    def connect(self):
        logger.info(f"Connecting to AWS IoT at {self.endpoint}:{self.port}")
        self.client.connect(self.endpoint, self.port, keepalive=60)
        self.client.loop_start()

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


if __name__ == "__main__":
    
    # Example configuration
    iot_client = AWSIoTClient(
        endpoint="a3f8example-ats.iot.us-east-1.amazonaws.com",
        port=8883,
        root_ca="certs/AmazonRootCA1.pem",
        certfile="certs/certificate.pem.crt",
        keyfile="certs/private.pem.key",
        client_id="edge-server-01",
        topic="microalgae/edge01/sensors"
    )

    iot_client.connect()

    try:
        while True:
            data = {
                "timestamp": int(time.time() * 1000),
                "device_id": "edge-server-01",
                "temperature": 26.3,
                "ph": 7.2
            }
            iot_client.publish_sensor_data(data)
            print("Published:", data)
            time.sleep(5)
    except KeyboardInterrupt:
        pass
    finally:
        iot_client.disconnect()