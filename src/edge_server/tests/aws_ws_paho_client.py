from awscrt import io, mqtt, auth, http
from awsiot import mqtt_connection_builder
import time

ENDPOINT = "a11r358gjcsqpj-ats.iot.eu-west-3.amazonaws.com"
REGION = "eu-west-3"
CLIENT_ID = "um-edge-server"
ROLE_ARN = "arn:aws:iam::820135570820:role/IoTEdgeServerRole"

# Create an event loop group
event_loop_group = io.EventLoopGroup(1)
host_resolver = io.DefaultHostResolver(event_loop_group)
client_bootstrap = io.ClientBootstrap(event_loop_group, host_resolver)

# Use your profile to assume role and fetch temporary credentials
import boto3

session = boto3.Session(profile_name="admin")
sts = session.client("sts")

creds = sts.assume_role(RoleArn=ROLE_ARN, RoleSessionName="edge-session")["Credentials"]

mqtt_connection = mqtt_connection_builder.websockets_with_default_aws_signing(
    endpoint=ENDPOINT,
    region=REGION,
    credentials_provider=auth.AwsCredentialsProvider.new_static(
        access_key_id=creds["AccessKeyId"],
        secret_access_key=creds["SecretAccessKey"],
        session_token=creds["SessionToken"],
    ),
    client_bootstrap=client_bootstrap,
    ca_filepath=None,  # uses system trust store
    on_connection_interrupted=lambda *args: print("Connection interrupted"),
    on_connection_resumed=lambda *args: print("Connection resumed"),
    client_id=CLIENT_ID,
    clean_session=False,
    keep_alive_secs=30,
)

logger.info("Connecting to AWS IoT Core...")
connect_future = mqtt_connection.connect()
connect_future.result()  # blocks until connected
logger.info("✅ Connected!")

# Test publish
mqtt_connection.publish(
    topic="ui/commands/test",
    payload="Hello from WebSocket client",
    qos=mqtt.QoS.AT_LEAST_ONCE,
)

def on_message_received(topic, payload, dup, qos, retain, **kwargs):
    logger.info(f"\n📩 Message received on topic '{topic}':")

topic = "ui/commands/#"
   
subscribe_future, packet_id = mqtt_connection.subscribe(
    topic=topic,
    qos=mqtt.QoS.AT_LEAST_ONCE,
    callback=on_message_received
)
subscribe_result = subscribe_future.result()
logger.info(f"✅ Subscribed to topic: {topic}")
try:
        
    while True:
        time.sleep(0.2)
except KeyboardInterrupt:
        
    mqtt_connection.disconnect().result()
    print("Disconnected.")
