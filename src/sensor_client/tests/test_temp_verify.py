
from sensors.temperature import TemperatureSensor
from shared.utils.config_loader import load_config
import time, os, sys

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../,,"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

def test_temp():
    print("Loading config...")
    config = load_config("src/sensor_client/config/sensors.json")
    
    # Find temperature config
    temp_config = next(s for s in config["sensors"] if s["type"] == "Temperature")
    
    print("Initializing TemperatureSensor...")
    sensor = TemperatureSensor("Temp Sensor", "Celsius", temp_config, "test_id")
    
    print("Reading temperature (10 samples)...")
    for i in range(10):
        reading = sensor.read()
        print(f"Reading {i+1}: {reading}")
        time.sleep(0.5)

if __name__ == "__main__":
    test_temp()
