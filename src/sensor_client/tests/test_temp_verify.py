import time, os, sys

# Set up paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SENSOR_CLIENT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../../.."))

if SENSOR_CLIENT_DIR not in sys.path:
    sys.path.insert(0, SENSOR_CLIENT_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
if os.path.join(PROJECT_ROOT, "src") not in sys.path:
    sys.path.insert(0, os.path.join(PROJECT_ROOT, "src"))

from sensors.temperature import TemperatureSensor
from shared.utils.config_loader import load_config

def test_temp():
    print("Loading config...")
    # Use absolute path for config
    config_path = os.path.join(SENSOR_CLIENT_DIR, "config/sensors.json")
    config = load_config(config_path)
    
    # Find temperature config
    temp_config = next(s for s in config["sensors"] if s["type"] == "Temperature")
    
    print("Initializing TemperatureSensor...")
    sensor = TemperatureSensor(temp_config["name"], temp_config["unit"], temp_config, "test_id")
    
    print("Reading temperature (10 samples)...")
    for i in range(10):
        reading = sensor.read()
        print(f"Reading {i+1}: {reading}")
        time.sleep(5)

if __name__ == "__main__":
    test_temp()
