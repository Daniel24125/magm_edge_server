# iot_client.py
import json
import time
import threading
from typing import Callable, Optional
import os 
import sys 

from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTClient

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger

class _BaseIoTClient:
    """
    Common MQTT wrapper for AWS IoT clients.
    Subclasses must implement _configure_transport() to set up the AWSIoTMQTTClient 'self._c'.
    """

    def __init__(
        self,
        client_id: str,
        endpoint: str,
        on_connect: Optional[Callable],
        on_disconnect: Optional[Callable],
        keep_alive: int = 600,
        mqtt_op_timeout: int = 15,
        connect_timeout: int = 15,
        on_message: Optional[Callable] = None,
    ):
        self.client_id = client_id
        self.endpoint = endpoint
        self.keep_alive = keep_alive
        self.mqtt_op_timeout = mqtt_op_timeout
        self.connect_timeout = connect_timeout
        self.on_message = on_message
        self.on_connect = on_connect
        self.on_disconnect = on_disconnect


        self._c: Optional[AWSIoTMQTTClient] = None
        self._stop = threading.Event()
        self._connected = threading.Event()
        self._lock = threading.Lock()

    # ---- Public API ----
    def connect(self):
        with self._lock:
            if self._c is None:
                self._configure_transport()
                # timeouts
                self._c.configureConnectDisconnectTimeout(self.connect_timeout)
                self._c.configureMQTTOperationTimeout(self.mqtt_op_timeout)

                # lifecycle callbacks
                self._c.onOnline = self._on_online
                self._c.onOffline = self._on_offline

                logger.info(f"Connecting MQTT client '{self.client_id}' to {self.endpoint} ...")
                self._c.connect()
        # optional: wait until online callback fires
        self._connected.wait(timeout=self.connect_timeout + 5)

    def subscribe(self, topic: str, qos: int = 1, callback: Optional[Callable] = None):
        cb = callback or self.on_message or (lambda c, u, m: logger.info(f"{m.topic}: {m.payload}"))
        if self._c is None:
            raise RuntimeError("Client not configured. Call connect() first.")
        logger.info(f"Subscribing to '{topic}' (QoS {qos})")
        res = self._c.subscribe(topic, qos, cb)
        logger.info(f"Subscribe result: {res}")
        if res is None:
            logger.warning("SUBACK not received within timeout. Retrying once ...")
            res = self._c.subscribe(topic, qos, cb)
            if res is None:
                raise TimeoutError(f"Subscribe timed out for topic '{topic}'")

    def publish(self, topic: str, payload: dict | str, qos: int = 1):
        if self._c is None:
            raise RuntimeError("Client not configured. Call connect() first.")
        msg = payload if isinstance(payload, str) else json.dumps(payload)
        logger.info(f"Publishing to '{topic}': {msg}")
        self._c.publish(topic, msg, qos)

    def disconnect(self):
        self._stop.set()
        if self._c:
            logger.info("Disconnecting MQTT client ...")
            try:
                self._c.disconnect()
            finally:
                self._connected.clear()

    # ---- Internals / hooks ----
    def _on_online(self):
        logger.info("✅ MQTT online")
        self._connected.set()
        if self.on_connect: 
            self.on_connect()

    def _on_offline(self):
        logger.warning("🔌 MQTT offline")
        self._connected.clear()
        if self.on_disconnect: 
            self.on_disconnect()
        if not self._stop.is_set():
            threading.Thread(target=self._reconnect_with_backoff, daemon=True).start()

    def _reconnect_with_backoff(self):
        delay = 2
        while not self._stop.is_set() and not self._connected.is_set():
            try:
                logger.info(f"Trying to reconnect in {delay}s ...")
                time.sleep(delay)
                with self._lock:
                    if self._c:
                        self._c.connect()
                # success if onOnline fires
            except Exception as e:
                logger.error(f"Reconnect failed: {e}")
            delay = min(delay * 2, 30)

    # must be provided by subclass
    def _configure_transport(self):
        raise NotImplementedError


class WebSocketIoTClient(_BaseIoTClient):
    """
    MQTT over WebSocket (port 443) using SigV4 (IAM/STS).
    - Provide: root CA path, AccessKeyId/SecretKey/SessionToken (temporary creds)
    - Optionally: call a function to assume a role first to obtain temp creds.
    """

    def __init__(
        self,
        client_id: str,
        endpoint: str,
        root_ca_path: str,
        access_key_id: str,
        secret_access_key: str,
        session_token: str,
        region: str = "eu-west-3",
        **kwargs,
    ):
        super().__init__(client_id, endpoint, **kwargs)
        self.root_ca_path = root_ca_path
        self.akid = access_key_id
        self.sak = secret_access_key
        self.sts = session_token
        self.region = region
 

    def _configure_transport(self):
        if not self.endpoint.endswith(f"-ats.iot.{self.region}.amazonaws.com"):
            logger.warning(f"Endpoint '{self.endpoint}' may not match region '{self.region}'")
        self._c = AWSIoTMQTTClient(self.client_id, useWebsocket=True)
        self._c.configureEndpoint(self.endpoint, 443)
        self._c.configureCredentials(self.root_ca_path)
        self._c.configureIAMCredentials(self.akid, self.sak, self.sts)


class TLSIoTClient(_BaseIoTClient):
    """
    MQTT over TLS mutual auth (port 8883) using X.509 device cert.
    - Provide: root CA, device cert, private key.
    - Requires an IoT Policy attached to the certificate in IoT Core.
    """

    def __init__(
        self,
        client_id: str,
        endpoint: str,
        root_ca_path: str,
        cert_path: str,
        key_path: str,
        **kwargs,
    ):
        super().__init__(client_id, endpoint, **kwargs)
        self.root_ca_path = root_ca_path
        self.cert_path = cert_path
        self.key_path = key_path

    def _configure_transport(self):
        self._c = AWSIoTMQTTClient(self.client_id)
        self._c.configureEndpoint(self.endpoint, 8883)
        self._c.configureCredentials(self.root_ca_path, self.key_path, self.cert_path)
