
from mqtt_server import MqttSubscriber
from aws import AWSIoTClient
from edge_server.manager import ManagerController
import  utils.thread_handler as t
import sys


def main():
    mqtt = MqttSubscriber(t.data_queue)    
    aws = AWSIoTClient(t.data_queue)
    manager = ManagerController(mqtt, aws)

    aws.start()
    mqtt.start()
    manager.start()

    try:
        while not t.stop_event.is_set():
            t.stop_event.wait(timeout=0.5)
    finally:
        print("🧹 Cleaning up resources...")
        mqtt.join(timeout=5)
        manager.join(timeout=5)
        aws._notify_user("rpi_disconnected", "The edge server is disconnected")
        aws.join(timeout=5)

        print("✅ Edge Server shut down cleanly.")
        sys.exit(0)



if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt as e: 
        print(e)

