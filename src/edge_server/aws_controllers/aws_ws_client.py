# src/edge_server/utils/aws_ws_client.py
import time, asyncio
from awscrt import mqtt, auth
from .aws_ws_client_config import AWSWSClientConfig
from .aws_ws_connection import AWSWSConnection
import os, sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.utils.logger import logger


class AWSWSClient:
    _callbacks = {
        "on_connect": None,
        "on_disconnect": None,
        "on_message": None
    }

    def __init__(self, endpoint, region, client_id, role_arn, profile_name="admin"):
        self.endpoint = endpoint
        self.region = region
        self.client_id = client_id
        self.role_arn = role_arn
        self.profile_name = profile_name
        self._mqtt = None
        self._config = AWSWSClientConfig(profile_name, role_arn, region)

    def register_on_connect(self, cb): self._callbacks["on_connect"] = cb
    def register_on_disconnect(self, cb): self._callbacks["on_disconnect"] = cb
    def register_on_message(self, cb): self._callbacks["on_message"] = cb

    # Build credentials provider (dynamic)
    def _get_credentials_provider(self):
        creds = self._config.get_credentials()
        return auth.AwsCredentialsProvider.new_static(
            creds["AccessKeyId"], creds["SecretAccessKey"], creds["SessionToken"]
        )

            
    def connect(self):
        self._config.auto_refresh_loop()  # start background refresh
        creds_provider = self._get_credentials_provider()
        conn_builder = AWSWSConnection(self.endpoint, self.region, self.client_id, creds_provider)
        self._mqtt = conn_builder.build()
        logger.info(f"Connecting {self.client_id} to AWS IoT over WebSocket...")
        self._mqtt.connect().result()

        self._mqtt._on_connection_closed = self._callbacks["on_disconnect"]

        if self._callbacks["on_message"]:
            self._mqtt.on_message = self._callbacks["on_message"]
        
        logger.info("✅ Connected and ready.")
        if self._callbacks["on_connect"]:
            try:
                self._callbacks["on_connect"]()
            except Exception as e:
                logger.exception(f"Error in on_connect callback: {e}")

    def subscribe(self, topic, callback):
        if not self._mqtt:
            raise RuntimeError("Not connected.")
        logger.info(f"Subscribing to {topic}")
        self._mqtt.subscribe(topic=topic, qos=mqtt.QoS.AT_LEAST_ONCE, callback=callback)

    def publish(self, topic, message):
        if not self._mqtt:
            raise RuntimeError("Not connected.")
        self._mqtt.publish(topic=topic, payload=message, qos=mqtt.QoS.AT_LEAST_ONCE)

    # Async-safe publish for sensor loops
    async def publish_async(self, topic, message):
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self.publish, topic, message)

    def loop_forever(self):
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self._mqtt.disconnect().result()
            logger.info("Disconnected.")