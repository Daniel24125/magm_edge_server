
import sys
import os

# Add 'src' to sys.path to allow absolute imports of 'edge_server'
current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.dirname(current_dir)
if src_dir not in sys.path:
    sys.path.append(src_dir)

from edge_server.edge_mqtt_client import EdgeMQTTClient
from edge_server.manager import ManagerController
import  edge_server.utils.thread_handler as t

def main():
    mqtt_client = EdgeMQTTClient(t.data_queue)    
    manager = ManagerController(mqtt_client)

    mqtt_client.start()
    manager.start()

    try:
        while not t.stop_event.is_set():
            t.stop_event.wait(timeout=0.5)
    finally:
        print("🧹 Cleaning up resources...")
        manager.join(timeout=5)
        mqtt_client.stop_process()
        mqtt_client.join(timeout=5)

        print("✅ Edge Server shut down cleanly.")
        sys.exit(0)



if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt as e: 
        print(e)

