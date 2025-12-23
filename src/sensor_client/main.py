import sys, os, time, json
from sensors.manager import SensorManager
from mqtt_client import MQTTClient
from config.config_manager import ConfigManager

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.config_loader import load_config
from shared.utils.logger import logger

config_manager = ConfigManager()

class SensorClient(): 
    time_elapsed = 0

    def __init__(self):
        self.init_config()
        self.init_sensor_client()

    def init_sensor_client(self): 
        self.manager = SensorManager(self.config)
        self.mqtt = MQTTClient(self.mqtt_config, self.manager)
        
        # Inject event publisher BEFORE starting the blocking loop
        self.manager.set_event_publisher(self.mqtt.publish_event)
        
        self.mqtt.connect()
    
    def init_config(self): 
        self.config = load_config(os.path.join(PROJECT_ROOT, "src/sensor_client/config/sensors.json"))
        self.mqtt_config = load_config(os.path.join(PROJECT_ROOT, "src/shared/config/mqtt.json"))
        if "device_config" not in self.config:
            raise ValueError("Missing 'device_config' configuration.")
        self.refresh_session_config()

    def refresh_session_config(self):
        config = load_config(os.path.join(PROJECT_ROOT, "src/edge_server/config/session.json"))
        if "sampling" not in config:
            raise ValueError("Missing 'sampling' configuration.")
        self.session_config = config
        self.read_interval = config["sampling"].get("sensor_interval", 1)




if __name__ == "__main__": 
    sensor_client = SensorClient()
