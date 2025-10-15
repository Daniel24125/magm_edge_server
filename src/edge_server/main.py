
from mqtt_server import MqttSubscriber
from aws import AWSIoTClient
import  utils.thread_handler as t
import sys, time




def main():
    subscriber_thread = MqttSubscriber(t.data_queue)    
    # subscriber_thread = threading.Thread(target=subscriber.run, daemon=True)

    aws_publisher_thread = AWSIoTClient(
        topic={"rpi":"microalgae/edge01/sensors"},
        data_queue=t.data_queue
    )
    # aws_thread = threading.Thread(target=aws_publisher.connect, daemon=True)
    subscriber_thread.start()
    aws_publisher_thread.start()

    try:
        # Main thread can monitor health or just sleep
        while not t.stop_event.is_set():
            time.sleep(0.5)
    finally:
        print("🧹 Cleaning up resources...")

        # Wait for threads to exit
        subscriber_thread.join(timeout=5)
        aws_publisher_thread.join(timeout=5)

        print("✅ Edge Server shut down cleanly.")
        sys.exit(0)

    # print("Edge server running. Press Ctrl+C to exit.")
    # subscriber_thread.join()
    # aws_thread.join()



if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt as e: 
        print(e)

