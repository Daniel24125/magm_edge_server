import paho.mqtt.client as mqtt
import json, time

class MQTTClient:
    def __init__(self, config):
        self.config = config
        self.client = mqtt.Client()
        self.client.connect(config["broker"], config["port"], keepalive=60)
        self.client.loop_start()

    def publish(self, topic, payload):
        try:
            self.client.publish(topic, payload)
        except Exception as e:
            print(f"MQTT publish failed: {e}")
