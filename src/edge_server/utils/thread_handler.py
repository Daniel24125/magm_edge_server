import signal
from queue import Queue
import threading



stop_event = threading.Event()
data_queue = Queue()

def shutdown_handler(signum, frame):
    print("\n🛑 Shutdown signal received. Stopping threads...")
    stop_event.set()

signal.signal(signal.SIGINT, shutdown_handler)
signal.signal(signal.SIGTERM, shutdown_handler)