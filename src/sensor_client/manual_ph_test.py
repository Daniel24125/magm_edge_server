import os, sys, time

# Setup Path to import shared modules
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# sensor_client/../../ -> src/
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))

if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

# Also add sensor_client for local imports
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from shared.utils.config_loader import load_config
from sensors.ph.ph import PHSensor
from sensors.base import state_manager

def main():
    print(f"--- Manual pH Control Test (Sim Mode: {state_manager.simulation_mode}) ---")
    
    # 1. Load Real Config
    config_path = os.path.join(CURRENT_DIR, "config", "sensors.json")
    if not os.path.exists(config_path):
        print(f"Error: Config not found at {config_path}")
        return

    config = load_config(config_path)
    
    # 2. Extract pH Config
    # Assuming 'sensors' is the key in config
    sensors_list = config.get("sensors", [])
    ph_config = next((s for s in sensors_list if s.get("type") == "pH"), None)
    
    if not ph_config:
        print("Error: No sensor with type 'pH' found in config.")
        return

    # 3. Initialize Sensor
    print("Initializing pH Sensor...")
    # Using a dummy ID for testing
    sensor = PHSensor(
        name=ph_config.get("name", "TestPH"), 
        unit="pH", 
        config=ph_config, 
        sensor_id="manual_test_id"
    )

    # 4. Enable Control
    target = 7.0
    print(f"Enabling Control -> Target: {target}, Tolerance: 0.1")
    sensor.update_control_settings({"phControl": True, "phSetPoint": target})

    print("\n[Instructions]")
    print(f" - Enter a pH value (e.g. 7.2 or 6.8) to simulate a reading.")
    print(f" - > {target + 0.1} should trigger ACID.")
    print(f" - < {target - 0.1} should trigger ALKALINE.")
    print(" - 'q' to quit.")
    print(" - *Cooldown is reset between inputs for easier testing*")

    while True:
        try:
            current_ph = sensor.read().value
            
            sensor.last_pump_activation = 0 
            
            print(f"Processing pH {current_ph}...")
            sensor.control_loop(current_ph)
            
            # Small sleep to let background pump thread log messages appear
            time.sleep(5)

        except ValueError:
            print("Invalid number. Please enter a float.")
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Unexpected error: {e}")

    print("\nExiting...")

if __name__ == "__main__":
    main()
