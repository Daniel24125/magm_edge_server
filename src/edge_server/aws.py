import ssl
import json
import threading
import os 
import sys
from typing import Dict, Any
import paho.mqtt.client as mqtt
from dotenv import load_dotenv
from utils.thread_handler import stop_event
from queue import Queue
import boto3
from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTClient


load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env.local"))
AWS_ENDPOINT = os.getenv('AWS_ENDPOINT')
AWS_CERTIFICATE = os.getenv('AWS_CERTIFICATE')
AWS_KEY = os.getenv('AWS_KEY')
AWS_ROOT_CERT = os.getenv('AWS_ROOT_CERT')
AWS_PORT = os.getenv('AWS_PORT')
AWS_CLIENT_ID = os.getenv('AWS_CLIENT_ID')
AWS_PUBLISH_TOPIC = os.getenv('AWS_PUBLISH_TOPIC')
AWS_USER_ACCESS_KEY = os.getenv('AWS_USER_ACCESS_KEY')
AWS_USER_SECRET_KEY = os.getenv('AWS_USER_SECRET_KEY')
AWS_EDGE_SERVER_ROLE = os.getenv('AWS_EDGE_SERVER_ROLE')

FILE_ROOT = os.path.dirname(os.path.abspath(__file__))
CERT_DIR = os.path.join(FILE_ROOT, "certs")


project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.utils.logger import logger
from shared.utils.state_manager import StateManager
state_manager = StateManager()

class AWSIoTClient(threading.Thread):
    def __init__(self, data_queue):
        super().__init__(daemon=True)
        self.data_queue = data_queue
        self.topic = json.loads(AWS_PUBLISH_TOPIC)
        self.init_variables()
        self.conenct_via_websocket()
        # self._configure_tls()
        # self._register_callbacks()
        # self.connect()

    def init_variables(self):
        self.endpoint = AWS_ENDPOINT
        self.port = int(AWS_PORT)
        self.root_ca = os.path.join(CERT_DIR,AWS_ROOT_CERT)
        self.certfile = os.path.join(CERT_DIR,AWS_CERTIFICATE)
        self.keyfile = os.path.join(CERT_DIR,AWS_KEY)
        self.client_id = AWS_CLIENT_ID
        self.client = mqtt.Client(client_id=self.client_id)

    def conenct_via_websocket(self):
        # Step 1: Assume the IAM role to get temporary credentials
        sts = boto3.client("sts",
            aws_access_key_id=AWS_USER_ACCESS_KEY,
            aws_secret_access_key=AWS_USER_SECRET_KEY,
            region_name="eu-west-3"
        )
        
        resp = sts.assume_role(
            RoleArn=AWS_EDGE_SERVER_ROLE,
            RoleSessionName="edge-session"
        )

        creds = resp["Credentials"]
        # Step 2: Connect over WebSockets 443
        mqtt = AWSIoTMQTTClient("rpi_edge", useWebsocket=True)
        mqtt.configureEndpoint(self.endpoint, 443)
        mqtt.configureCredentials(self.root_ca)
        mqtt.configureIAMCredentials(
            creds["AccessKeyId"],
            creds["SecretAccessKey"],
            creds["SessionToken"]
        )

        mqtt.connect()
        print("Connected ✅")

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
            self.client.subscribe("ui/commands/#", qos=1)
        else:
            logger.error(f"Connection failed with code {rc}")
            state_manager.update_aws_status(False)

    def on_disconnect(self, client, userdata, rc):
        logger.warning(f"Disconnected from AWS IoT Core: {rc}")
        state_manager.update_aws_status(False)

    def on_message(self, client, userdata, msg):
        topic = msg.topic
        payload = msg.payload.decode()
        logger.info(f"Received message from AWS on {topic}: {payload}")
        if hasattr(self, "data_queue") and isinstance(self.data_queue, Queue):
            self.data_queue.put({"topic": topic, "payload": json.loads(payload)})
            logger.info("Forwarded AWS message to data_queue for SessionController.")
        else:
            self.parse_user_commands(payload, topic)
        
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
        payload: {
            'source': str, 
            'device_id': str, 
            'session_id': str, 
            'data': {
                'sensor_name': float
            }
        }
        """
        try: 
            message = json.dumps(payload)
            source = payload.get("source", "")
            topic = json.loads(AWS_PUBLISH_TOPIC).get(source)
            logger.info(f"Publishing to {topic}: {message}")
            self.client.publish(topic, message, qos=1)
        except Exception as err: 
            logger.error(f"An error occured while trying to send to AWS IoT core: {err}")

    def run(self): 
        logger.info("Listenning for sensor data...")
