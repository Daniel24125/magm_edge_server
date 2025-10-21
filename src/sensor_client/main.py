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
        self.mqtt = MQTTClient(self.mqtt_config, self)
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

    
    def display_readings(self, readings):
        print("\n--- Sensor Readings ---")
        for sensor_name, reading in readings.items():
            if reading:
                formatted_value = f"{reading.value:.2f}"
                logger.info(f"{sensor_name}: {formatted_value} {reading.unit}")
            else:
                logger.error(f"{sensor_name}: Failed to read sensor.")

    def start_acquisition_loop(self):
        
        print(f"\nStarting main loop. Reading sensors every {self.read_interval} seconds.\n")
        print("Press Ctrl+C to exit.")
        try:
            while True:
                all_readings = self.manager.read_all_sensors()
                if self.time_elapsed % self.read_interval == 0:
                    # self.display_readings(all_readings)
                    self.mqtt.publish_sensor_data(all_readings)
                time.sleep(1)
                self.time_elapsed += 1
        except KeyboardInterrupt:
            logger.warning("Stopping sensor acquisition...")
        except Exception as e:
            logger.error(f"Unexpected error in acquisition loop: {e}")



if __name__ == "__main__": 
    sensor_client = SensorClient()
    # sensor_client.start_acquisition_loop()