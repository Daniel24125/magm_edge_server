# src/edge_server/utils/aws_ws_connection.py
from awscrt import io
from awsiot import mqtt_connection_builder


class AWSWSConnection:
    def __init__(self, endpoint, region, client_id, creds_provider):
        self.endpoint = endpoint
        self.region = region
        self.client_id = client_id
        self.creds_provider = creds_provider
        self.mqtt_connection = None

    def build(self):
        event_loop_group = io.EventLoopGroup(1)
        host_resolver = io.DefaultHostResolver(event_loop_group)
        client_bootstrap = io.ClientBootstrap(event_loop_group, host_resolver)

        self.mqtt_connection = mqtt_connection_builder.websockets_with_default_aws_signing(
            endpoint=self.endpoint,
            region=self.region,
            credentials_provider=self.creds_provider,
            client_bootstrap=client_bootstrap,
            client_id=self.client_id,
            clean_session=False,
            keep_alive_secs=30,
            reconnect_min_timeout_secs=2,
            reconnect_max_timeout_secs=60,
            reconnect_stable_time_secs=20
        )
        return self.mqtt_connection