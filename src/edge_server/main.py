
from mqtt_server import MqttSubscriber, MQTT_HOST, MQTT_PORT, TOPIC_TO_SUBSCRIBE


if __name__ == "__main__":
    subscriber = MqttSubscriber(
        host=MQTT_HOST,
        port=MQTT_PORT,
        topic=TOPIC_TO_SUBSCRIBE
    )
    subscriber.run()
 
