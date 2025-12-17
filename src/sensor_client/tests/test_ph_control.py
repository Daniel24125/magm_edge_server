
import os, sys, time
from unittest.mock import MagicMock
from collections import deque

# Setup Path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.config_loader import load_config
from sensor_client.sensors.ph.ph import PHSensor

def test_ph_control_logic():
    print("--- Starting pH Control Logic Test ---")

    # 1. Mock Config
    config = {
        "read_window_size": 10,
        "read_stability_threshold": 0.02,
        "drift_stability_threshold": 0.005,
        "pin": {
            "acidic": 10,
            "alkaline": 9
        }
    }

    # 2. Instantiate Sensor
    # We pass a dummy ID
    sensor = PHSensor("Test pH Sensor", "pH", config, "test_sensor_id")
    
    # Mock Hardware/Communication to avoid errors
    sensor.init_gpio = MagicMock()
    sensor.get_instrument_read = MagicMock(return_value=None) # We won't call read() directly for logic test
    sensor.test_pump = MagicMock()

    # 3. Configure Control Settings
    print("[Action] Enabling Control. Target: 7.0")
    sensor.update_control_settings({"phControl": True, "phSetPoint": 7.0})

    # 4. Scenarios

    # Scenario A: pH is PERFECT (7.0) -> No Action
    print("\n[Test] pH = 7.0 (Target 7.0)")
    sensor.control_loop(current_ph=7.0)
    sensor.test_pump.assert_not_called()
    print("PASS: No pump activated.")

    # Scenario B: pH is Basic (7.2) -> Acid Pump
    # Tolerance is 0.1, so > 7.1 triggers Acid
    print("\n[Test] pH = 7.2 (Target 7.0) -> Expect ACID pump")
    time.sleep(6) # Wait for cooldown (5s)
    sensor.control_loop(current_ph=7.2)
    sensor.test_pump.assert_called_with("acidic", duration=0.5)
    print("PASS: Acid pump activated.")
    
    sensor.test_pump.reset_mock()

    # Scenario C: Cooldown Check
    print("\n[Test] Immediate retry (pH 7.2) -> Expect NO Action (Cooldown)")
    sensor.control_loop(current_ph=7.2)
    sensor.test_pump.assert_not_called()
    print("PASS: Cooldown respected.")

    # Scenario D: pH is Acidic (6.8) -> Alkaline Pump
    # Tolerance is 0.1, so < 6.9 triggers Alkaline
    print("\n[Test] pH = 6.8 (Target 7.0) -> Expect ALKALINE pump")
    time.sleep(6) # Wait for cooldown
    sensor.control_loop(current_ph=6.8)
    sensor.test_pump.assert_called_with("alkaline", duration=0.5)
    print("PASS: Alkaline pump activated.")
    
    sensor.test_pump.reset_mock()

    # Scenario E: pH is within tolerance (7.05) -> No Action
    print("\n[Test] pH = 7.05 (Target 7.0) -> Expect NO Action")
    time.sleep(6)
    sensor.control_loop(current_ph=7.05)
    sensor.test_pump.assert_not_called()
    print("PASS: In tolerance.")

    print("\n--- All Tests Passed ---")

if __name__ == "__main__":
    test_ph_control_logic()
