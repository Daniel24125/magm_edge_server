import json
import threading
import os 
import sys
from typing import Dict, Any
from dotenv import load_dotenv
from queue import Queue
from aws_controllers.aws_ws_client import AWSWSClient

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env.local"))
AWS_REGION = os.getenv('AWS_REGION')
AWS_ENDPOINT = os.getenv('AWS_ENDPOINT')
AWS_CERTIFICATE = os.getenv('AWS_CERTIFICATE')
AWS_KEY = os.getenv('AWS_KEY')
AWS_ROOT_CERT = os.getenv('AWS_ROOT_CERT')
AWS_PORT = os.getenv('AWS_PORT')
AWS_CLIENT_ID = os.getenv('AWS_CLIENT_ID')
AWS_USER_ACCESS_KEY = os.getenv('AWS_USER_ACCESS_KEY')
AWS_USER_SECRET_KEY = os.getenv('AWS_USER_SECRET_KEY')

AWS_EDGE_SERVER_ROLE = os.getenv('AWS_EDGE_SERVER_ROLE')
AWS_PUBLISH_TOPIC = os.getenv('AWS_PUBLISH_TOPIC')

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
        self.client = AWSWSClient(
            endpoint=AWS_ENDPOINT,
            region=AWS_REGION,
            client_id=AWS_CLIENT_ID,
            role_arn=AWS_EDGE_SERVER_ROLE
        )

    def connect_via_websocket(self): 
        self._register_callbacks()
        self.client.connect()
     
    def _register_callbacks(self):
        self.client.register_on_connect(self.on_connect)
        self.client.register_on_disconnect(self.on_disconnect)
        self.client.register_on_message(self.on_message)


    # --- Callbacks ---
    def on_connect(self):
        logger.info("Connected to AWS IoT Core")
        state_manager.update_aws_status(True)
        self.client.subscribe("ui/commands/#", callback=self.on_message)

    def on_disconnect(self):
        logger.warning(f"Disconnected from AWS IoT Core:")
        state_manager.update_aws_status(False)

    def on_message(self, topic, payload, dup, qos, retain, **kwargs):
        parsed_payload = payload.decode()
        logger.info(f"Received message from AWS on {topic}: {parsed_payload}")
        if hasattr(self, "data_queue") and isinstance(self.data_queue, Queue):
            self.data_queue.put({"topic": topic, "payload": json.loads(parsed_payload)})
            logger.info("Forwarded AWS message to data_queue for SessionController.")
        else:
            raise Exception("A data_queue must be provided")

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
            self.client.publish(topic, message)
        except Exception as err: 
            logger.error(f"An error occured while trying to send to AWS IoT core: {err}")

    def publish_prompt_user(self, payload):
        logger.info("Sending message to user...")
        self.client.publish("user/device/prompt", json.dumps(payload))

    def publish_heartbeat(self, payload):
        self.client.publish("status/heartbeat",json.dumps(payload))

    def run(self): 
        logger.info("Running the AWS thread...")
        self.connect_via_websocket()

