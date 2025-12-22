import os, sys, time

# Setup Path to import shared modules
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# sensor_client/tests/../../ -> src/
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "../.."))

if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

# Add sensor_client to sys.path
SENSOR_CLIENT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SENSOR_CLIENT_DIR not in sys.path:
    sys.path.insert(0, SENSOR_CLIENT_DIR)

# Also add tests dir for local imports if needed
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

# Mock Hardware Libraries if missing (Must be done before importing sensors which import hardware)
from unittest.mock import MagicMock
try:
    import board
except ImportError:
    sys.modules["board"] = MagicMock()
    sys.modules["busio"] = MagicMock()
    sys.modules["adafruit_ads1x15"] = MagicMock()
    sys.modules["adafruit_ads1x15.ads1115"] = MagicMock()
    sys.modules["adafruit_ads1x15.analog_in"] = MagicMock()
    sys.modules["lgpio"] = MagicMock()

from shared.utils.config_loader import load_config
from sensors.ph.ph import PHSensor
from sensors.base import state_manager

TARGET_PH = 7.0
config_path = os.path.join(CURRENT_DIR, "../config", "sensors.json")
if not os.path.exists(config_path):
    print(f"Error: Config not found at {config_path}")
    

config = load_config(config_path)
 
# 2. Extract pH Config
sensors_list = config.get("sensors", [])
ph_config = next((s for s in sensors_list if s.get("type") == "pH"), None)

def purge_pumps():
    print(f"--- Manual pH Control --- Purging Pumps...")

   
    if not ph_config:
        print("Error: No sensor with type 'pH' found in config.")
        return

    # 3. Initialize Sensor+Pumps
    print("Initializing pH Sensor...")
    sensor = PHSensor(
        name=ph_config.get("name", "TestPH"), 
        unit="pH", 
        config=ph_config, 
        sensor_id="manual_test_id"
    )
    pump_controller = sensor.controller
    sensor.test_pump(duration=10, pump_type="acidic")
    time.sleep(10)
    pump_controller.stop_pumps()
    
    sensor.test_pump(duration=10, pump_type="alkaline")
    time.sleep(10)

    pump_controller.stop_pumps()


def main():
    print(f"--- Manual pH Control Test (Sim Mode: {state_manager.simulation_mode}) ---")
    
    if not ph_config:
        print("Error: No sensor with type 'pH' found in config.")
        return

    # 3. Initialize Sensor
    print("Initializing pH Sensor...")
    sensor = PHSensor(
        name=ph_config.get("name", "TestPH"), 
        unit="pH", 
        config=ph_config, 
        sensor_id="manual_test_id"
    )
    pump_controller = sensor.controller

    # 4. Enable Control
    print(f"Enabling Control -> Target: {TARGET_PH}, Tolerance: 0.1")
    sensor.update_control_settings({"phControl": True, "phSetPoint": TARGET_PH})

    print("\n[Instructions]")
    print(f" - The test will run continuously mimicking the session loop.")
    print(f" - The simulated sensor is configured with LOW NOISE to ensure stability.")
    print(f" - > {TARGET_PH + 0.1} should trigger ACID.")
    print(f" - < {TARGET_PH - 0.1} should trigger ALKALINE.")
    print(" - Press Ctrl+C to quit.")
    
    if hasattr(sensor, "start_control_thread"):
        sensor.start_control_thread()
    else:
        print("Warning: start_control_thread not found on sensor object")
    
    # 5. ADJUST CONFIG FOR TESTING PUMP LOGIC
    if hasattr(sensor, 'simulator_init'):
         pass
    
    sensor.stability_threshold = 0.5 
    sensor.drift_stability_threshold = 0.5
    print(f" - Adjusted Stability Thresholds to {sensor.stability_threshold} to force stable readings for testing.")

    while True:
        try:
            sensor.read()
            val = sensor.values[-1] if sensor.values else 0
            is_stable = sensor.last_stable
            print(f"Current: {val:.2f} | Stable: {is_stable}")
            time.sleep(1)
        except KeyboardInterrupt:
            pump_controller.stop_pumps()
            break
        except Exception as e:
            print(f"Unexpected error: {e}")
            pump_controller.stop_pumps()

    pump_controller.stop_pumps()
    print("\nExiting...")

if __name__ == "__main__":
    main()
