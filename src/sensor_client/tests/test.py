from sensors.ph.ph import PHSensor
from sensors.ph.calibration_manager import PHCalibrationManager
from sensors.manager import SensorManager
import sys, os, time
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../,,"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

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
        print(f"read: {read.value} | is stable? {read.is_stable}")
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