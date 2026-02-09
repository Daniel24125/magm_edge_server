import os, sys, time, argparse
from unittest.mock import MagicMock

# Setup Path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "../.."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

# Add sensor_client to sys.path
SENSOR_CLIENT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SENSOR_CLIENT_DIR not in sys.path:
    sys.path.insert(0, SENSOR_CLIENT_DIR)

from shared.utils.config_loader import load_config
from sensors.base import state_manager

# Ensure simulation mode is handled before imports that might crash
parser = argparse.ArgumentParser(description='pH Analog Acquisition Test')
parser.add_argument('--simulate', action='store_true', help='Enable simulation mode (mocked hardware)')
parser.add_argument('--samples', type=int, default=10, help='Number of samples to collect')
args = parser.parse_args()

if args.simulate:
    state_manager.simulation_mode = True
    print("--- Running in SIMULATION MODE ---")
else:
    print("--- Running in HARDWARE MODE ---")

from utils.comunication import AnalogCommunication

def run_acquisition_test():
    # 1. Load Config
    config_path = os.path.join(CURRENT_DIR, "../config/sensors.json")
    try:
        full_config = load_config(config_path)
        # Find pH sensor config (usually at index 1 or by type)
        ph_config = next((s for s in full_config.get("sensors", []) if s.get("type") == "pH"), None)
        if not ph_config:
             print("Error: pH sensor config not found in sensors.json")
             return
    except Exception as e:
        print(f"Error loading config: {e}")
        return

    # 2. Initialize AnalogCommunication
    # Note: AnalogCommunication uses the database to get calibration params.
    comm = AnalogCommunication(ph_config)
    
    # 3. Handle Simulation Mocking if requested
    if args.simulate:
        print("[Mocking] Simulating ADS1115 input at 15000 raw bits...")
        # Mock the 'analog' object which is an AnalogIn instance
        comm.analog = MagicMock()
        # Mock .value to return a stable raw value (e.g., 15000)
        comm.analog.value = 15000 

    # 4. Perform Acquisition
    print(f"\nStarting acquisition ({args.samples} cycles)...")
    print(f"{'Sample':<10} | {'Raw Avg':<15} | {'pH Value':<10}")
    print("-" * 40)

    try:
        for i in range(args.samples):
            # comm.get_analog_read(20) returns the average of 20 samples
            raw_avg = comm.get_analog_read(20)
            ph_val = comm.convert_analog(raw_avg)
            
            print(f"{i+1:<10} | {raw_avg:<15.2f} | {ph_val:<10.2f}")
            time.sleep(0.5)
            
    except KeyboardInterrupt:
        print("\nTest stopped by user.")
    except Exception as e:
        print(f"\nError during acquisition: {e}")

    print("\n--- Test Finished ---")

if __name__ == "__main__":
    run_acquisition_test()
