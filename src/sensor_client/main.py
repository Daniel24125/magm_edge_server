import sys, os, time, platform
from sensors.manager import SensorManager



SIMULATION_MODE = platform.system() == "Windows"

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.config_loader import load_config
from shared.utils.logger import logger

class SensorClient(): 
    time_elapsed = 0

    def __init__(self):
        self.init_config()
        self.init_sensor_client()

    def init_sensor_client(self): 
        self.manager = SensorManager(self.config)
        
    def init_config(self): 
        self.config = load_config(os.path.join(PROJECT_ROOT, "src/sensor_client/config/sensors.json"))
        if "sampling" not in self.config:
            raise ValueError("Missing 'sampling' configuration.")
        self.read_interval = self.config["sampling"].get("sensor_interval", 1)

    def display_readings(self, readings):
        print("\n--- Sensor Readings ---")
        for sensor_name, reading in readings.items():
            if reading:
                formatted_value = f"{reading.value:.2f}"
                logger.info(f"{sensor_name}: {formatted_value} {reading.unit}")
            else:
                logger.error(f"{sensor_name}: Failed to read sensor.")

    def start_acquisition_loop(self):
        
        print(f"\nStarting main loop. Reading sensors every {self.read_interval} seconds.")
        print("Press Ctrl+C to exit.")
        try:
            while True:
                all_readings = self.manager.read_all_sensors()
                if self.time_elapsed % self.read_interval == 0:
                    self.display_readings(all_readings)
                time.sleep(1)
                self.time_elapsed += 1
        except KeyboardInterrupt:
            logger.error("\nStopping sensor acquisition...")
        except Exception as e:
            logger.error(f"Unexpected error in acquisition loop: {e}")


def main():
    sensor_client = SensorClient()
    sensor_client.start_acquisition_loop()

if __name__ == "__main__": 
    main()