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


from sensors.ph.ph import PHSensor
from sensors.ph.calibration_manager import PHCalibrationManager
from sensors.manager import SensorManager

from edge_server.database.db_manager import DatabaseHelper
from shared.utils.config_loader import load_config


config = load_config("src/sensor_client/config/sensors.json")
manager = SensorManager(config)

def get_analog_ph_read(): 
    sensor = manager.get_sensor("e6cc7497-d0aa-4cd9-9e56-578b6f9db521")
    import time
    while True:
        read = sensor.analog_comunicator.get_analog_read() 
        print(read)
        time.sleep(1)
        
def get_ph_read():
    sensor = manager.get_sensor("e6cc7497-d0aa-4cd9-9e56-578b6f9db521")
    import time
    while True:
        read = sensor.read() 
        # Access internal raw value from AnalogCommunication for debugging if possible, 
        # or just print the value. PHSensor doesn't expose raw directly in SensorReading.
        # But we can access sensor.raw_values[-1] if valid.
        raw = sensor.raw_values[-1] if sensor.raw_values else "N/A"
        print(f"ts: {read.timestamp:.2f} | read: {read.value} | raw: {raw} | is stable? {read.is_stable}")
        time.sleep(1)

def test_cal():
  sensor = PHSensor("Ph sensor", "", config, "owiebhfowebfbfweoibf")

  db =  DatabaseHelper("src/edge_server/database/models/sessions.db")
  payload = {
      "device_id": "wodvgoeijhifh wef i",
      "sensor_id": config.get("sensor_id"), 
      "user_name": "Daniel Madalena"
  }
  calibrator = PHCalibrationManager(None, db,sensor.read, sensor.get_last_raw_average, payload)
  calibrator.start()
  
  try:
      while True:
          time.sleep(1)
  except KeyboardInterrupt:
      calibrator.reset_calibration()
      print("\nExiting...")

if __name__ == "__main__": 
  get_ph_read()