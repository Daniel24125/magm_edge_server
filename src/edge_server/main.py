
from mqtt_server import MqttSubscriber
from aws import AWSIoTClient
from edge_server.session_controller import SessionController
import  utils.thread_handler as t
import sys


def main():
    mqtt = MqttSubscriber(t.data_queue)    
    aws = AWSIoTClient(data_queue=t.data_queue)
    session_controller = SessionController(mqtt, aws)

    mqtt.start()
    aws.start()
    session_controller.start()

    try:
        while not t.stop_event.is_set():
            t.stop_event.wait(timeout=0.5)
    finally:
        print("🧹 Cleaning up resources...")
        mqtt.join(timeout=5)
        session_controller.join(timeout=5)
        aws._notify_user("rpi_disconnected", "")
        aws.join(timeout=5)

        print("✅ Edge Server shut down cleanly.")
        sys.exit(0)



if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt as e: 
        print(e)

