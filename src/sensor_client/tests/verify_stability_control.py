import sys
import os
import time
from unittest.mock import MagicMock, patch

# Setup paths
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "../.."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)
SENSOR_CLIENT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SENSOR_CLIENT_DIR not in sys.path:
    sys.path.insert(0, SENSOR_CLIENT_DIR)

# Mock board and lgpio before importing anything that uses them
from unittest.mock import MagicMock
sys.modules['board'] = MagicMock()
sys.modules['busio'] = MagicMock()
sys.modules['lgpio'] = MagicMock()
sys.modules['adafruit_ads1x15'] = MagicMock()
sys.modules['adafruit_ads1x15.ads1115'] = MagicMock()
sys.modules['adafruit_ads1x15.analog_in'] = MagicMock()

# Set simulation mode explicitly (though mocking modules should be enough to satisfy imports)
# We need to import state_manager to set logic if needed, but the import in ph.py is what matters.
# However, to avoid import errors in 'utils.comunication', mocking board is safer.

from sensors.ph.ph import PHSensor

def test_stability_control():
    print("--- Testing pH Stability Control ---")
    
    # Mock config
    config = {
        "key": "ph",
        "type": "pH",
        "name": "TestPH", 
        "sensor_id": "test_id",
        "read_window_size": 10,
        "read_stability_threshold": 0.02,
        "probe": 0, # Added probe to avoid IndexError
        "pin": {"acidic": 10, "alkaline": 9}
    }
    
    # Instantiate sensor
    # We create a dummy init to avoid real GPIO/Simulation setup issues
    with patch('sensors.ph.ph.PHSensor.init_gpio'), \
         patch('sensors.ph.ph.PHSensor.init_read_settings'), \
         patch('sensors.ph.ph.AnalogCommunication'):
         
        sensor = PHSensor("TestPH", "pH", config, "test_id")
        # Manually call init_read_settings to setup deque
        sensor.config = config
        sensor.init_read_settings()
        
    sensor.control_enabled = True
    sensor.target_ph = 7.0
    
    # Mock test_pump to track calls
    sensor.test_pump = MagicMock()
    
    # TEST 1: Unstable, pH high -> Should NOT pump
    print("\nTest 1: Unstable, pH 8.0 (Target 7.0)")
    sensor.last_stable = False
    current_ph = 8.0
    sensor.control_loop(current_ph)
    
    if sensor.test_pump.called:
        print("FAIL: Pump was activated when unstable!")
    else:
        print("PASS: Pump was NOT activated when unstable.")

    # TEST 2: Stable, pH high -> Should pump acid
    print("\nTest 2: Stable, pH 8.0 (Target 7.0)")
    sensor.last_stable = True
    # Reset mock
    sensor.test_pump.reset_mock()
    # Ensure cooldown doesn't block (reset cooldown)
    sensor.last_pump_activation = 0
    
    sensor.control_loop(current_ph)
    
    if sensor.test_pump.called:
        args, _ = sensor.test_pump.call_args
        if args[0] == "acidic":
             print("PASS: Pump 'acidic' was activated when stable.")
        else:
             print(f"FAIL: Wrong pump activated: {args[0]}")
    else:
        print("FAIL: Pump was NOT activated when stable!")

    # TEST 3: Unstable, pH low -> Should NOT pump
    print("\nTest 3: Unstable, pH 6.0 (Target 7.0)")
    sensor.last_stable = False
    current_ph = 6.0
    sensor.test_pump.reset_mock()
    sensor.last_pump_activation = 0
    
    sensor.control_loop(current_ph)
    
    if sensor.test_pump.called:
        print("FAIL: Pump was activated when unstable!")
    else:
        print("PASS: Pump was NOT activated when unstable.")

    # TEST 4: Stable, pH low -> Should pump alkaline
    print("\nTest 4: Stable, pH 6.0 (Target 7.0)")
    sensor.last_stable = True
    sensor.test_pump.reset_mock()
    sensor.last_pump_activation = 0
    
    sensor.control_loop(current_ph)
    
    if sensor.test_pump.called:
        args, _ = sensor.test_pump.call_args
        if args[0] == "alkaline":
             print("PASS: Pump 'alkaline' was activated when stable.")
        else:
             print(f"FAIL: Wrong pump activated: {args[0]}")
    else:
        print("FAIL: Pump was NOT activated when stable!")


if __name__ == "__main__":
    test_stability_control()
