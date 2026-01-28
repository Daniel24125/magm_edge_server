
import os, sys, time
from unittest.mock import MagicMock
from collections import deque

# Setup Path
# We need to add 'src' to sys.path to import 'shared'
# We are in src/sensor_client
# ../.. takes us to src
# ../.. takes us to src
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# shared is in src/shared, so we need to add src to sys.path
# src is the parent of sensor_client, so we use "../.."
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "../.."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

# Add sensor_client to sys.path
SENSOR_CLIENT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SENSOR_CLIENT_DIR not in sys.path:
    sys.path.insert(0, SENSOR_CLIENT_DIR)

# Also add tests dir itself if needed for local imports
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)


from shared.utils.config_loader import load_config
from sensors.base import state_manager

from sensors.ph.ph import PHSensor

def test_ph_control_logic():
    print(f"--- Starting pH Control Logic Test (Sim Mode: {state_manager.simulation_mode}) ---")

    # 1. Mock Config
    config = load_config(os.path.join(CURRENT_DIR, "../config/sensors.json")).get("sensors")[1]

    # 2. Instantiate Sensor
    sensor = PHSensor("Test pH Sensor", "pH", config, "test_sensor_id")
    
    # We want to test logic, so we mock test_pump in the controller to see calls
    sensor.controller.test_pump = MagicMock()

    # 3. Configure Control Settings
    print("[Action] Enabling Control. Target: 7.0")
    sensor.update_control_settings({"phSetPoint": 7.0, "enabled": True})

    # 4. Scenarios

    # Scenario A: pH is PERFECT (7.0) -> No Action
    print("\n[Test] pH = 7.0 (Target 7.0)")
    sensor.controller._evaluate_and_act(current_ph=7.0, is_stable=True)
    sensor.controller.test_pump.assert_not_called()
    print("PASS: No pump activated.")

    # Scenario B: pH is Basic (7.2) -> Acid Pump
    # Tolerance is 0.1, so > 7.1 triggers Acid
    print("\n[Test] pH = 7.2 (Target 7.0) -> Expect ACID pump")
    time.sleep(6) # Wait for cooldown (5s)
    sensor.controller._evaluate_and_act(current_ph=7.2, is_stable=True)
    # The calculation for 7.2 with target 7.0 and default max_pump_time (0.3)
    # duration = (0.2 * 0.3) = 0.06 (clamped between 0.05 and 0.3)
    sensor.controller.test_pump.assert_called_once()
    args, kwargs = sensor.controller.test_pump.call_args
    assert args[0] == "acidic"
    print(f"PASS: Acid pump activated with duration {kwargs.get('duration', args[1] if len(args)>1 else 'unknown')}")
    
    sensor.controller.test_pump.reset_mock()

    # Scenario C: Cooldown Check
    print("\n[Test] Immediate retry (pH 7.2) -> Expect NO Action (Cooldown)")
    sensor.controller._evaluate_and_act(current_ph=7.2, is_stable=True)
    sensor.controller.test_pump.assert_not_called()
    print("PASS: Cooldown respected.")

    # Scenario D: pH is Acidic (6.8) -> Alkaline Pump
    # Tolerance is 0.1, so < 6.9 triggers Alkaline
    print("\n[Test] pH = 6.8 (Target 7.0) -> Expect ALKALINE pump")
    time.sleep(6)
    sensor.controller._evaluate_and_act(current_ph=6.8, is_stable=True)
    sensor.controller.test_pump.assert_called_once()
    args, kwargs = sensor.controller.test_pump.call_args
    assert args[0] == "alkaline"
    print(f"PASS: Alkaline pump activated with duration {kwargs.get('duration', args[1] if len(args)>1 else 'unknown')}")
    
    sensor.controller.test_pump.reset_mock()

    print("\n--- All Tests Passed ---")

if __name__ == "__main__":
    test_ph_control_logic()
