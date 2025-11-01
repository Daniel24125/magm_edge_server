import ssl
import json
import threading
import os 
import sys
from typing import Dict, Any
from dotenv import load_dotenv
from queue import Queue
import boto3
from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTClient
from utils.iot_client import WebSocketIoTClient

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env.local"))
AWS_REGION = os.getenv('AWS_REGION')
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
    topic = json.loads(AWS_PUBLISH_TOPIC)
    endpoint = AWS_ENDPOINT
    port = int(AWS_PORT)
    root_ca = os.path.join(CERT_DIR,AWS_ROOT_CERT)
    certfile = os.path.join(CERT_DIR,AWS_CERTIFICATE)
    keyfile = os.path.join(CERT_DIR,AWS_KEY)
    client_id = AWS_CLIENT_ID
    region = AWS_REGION
    creds = None


    def __init__(self, data_queue):
        super().__init__(daemon=True)
        self.data_queue = data_queue



    def fetch_websocket_credentials(self):
        logger.info("Fetching temporary IAM credentials via STS...")
        sts = boto3.client(
            "sts",
            aws_access_key_id=AWS_USER_ACCESS_KEY,
            aws_secret_access_key=AWS_USER_SECRET_KEY,
            region_name=self.region,
        )
        try:
            resp = sts.assume_role(
                RoleArn=AWS_EDGE_SERVER_ROLE,
                RoleSessionName="edge-session"
            )
            return resp["Credentials"]
        except Exception as e:
            logger.error(f"Failed to assume role {AWS_EDGE_SERVER_ROLE}: {e}")
            raise

    def connect_via_websocket(self): 
        self.creds = self.fetch_websocket_credentials()
        import uuid
        unique_client_id = f"{self.client_id}-{uuid.uuid4().hex[:6]}"
        self.client = WebSocketIoTClient(
            client_id=unique_client_id,
            endpoint=self.endpoint,
            root_ca_path=self.root_ca,
            access_key_id=self.creds["AccessKeyId"],
            secret_access_key=self.creds["SecretAccessKey"],
            session_token=self.creds["SessionToken"],
            region=self.region, 
            on_connect=self.on_connect,
            on_disconnect=self.on_disconnect
        )
        self.client.connect()

   
     
    # --- Callbacks ---
    def on_connect(self):
        logger.info("Connected to AWS IoT Core")
        state_manager.update_aws_status(True)
        self.client.subscribe("ui/commands/#", qos=1, callback=self.on_message)

    def on_disconnect(self):
        logger.warning(f"Disconnected from AWS IoT Core:")
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
        logger.info("Running the AWS thread...")
        self.connect_via_websocket()

