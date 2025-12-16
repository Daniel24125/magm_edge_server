from sensors.ph.ph import PHSensor
from sensors.ph.calibration_manager import PHCalibrationManager
import sys, os, time
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../,,"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from edge_server.database.db_manager import DatabaseHelper


config = {
      "key": "ph",
      "type": "pH",
      "name": "pH Sensor 1",
      "sensor_id": "e6cc7497-d0aa-4cd9-9e56-578b6f9db521",
      "unit": "",
      "enabled": True,
      "probe": 3,
      "read_window_size": 10,
      "read_stability_threshold": 0.02,
      "pin":{
          "acidic": 10,
          "alkaline": 9,
          "alkaline_pump_pin": 10, 
          "acidic_pump_pin": 10
      },
      "simulator_params": {
        "min_val": 6.0,
        "max_val": 8.5,
        "period_seconds": 43200,
        "noise": 0.05
      }
    }

def get_analog_ph_read(): 
    sensor = PHSensor("Ph sensor", "", config, "owiebhfowebfbfweoibf")
    import time
    while True:
        read = sensor.analog_comunicator.get_analog_read() 
        print(read)
        time.sleep(1)
        
def get_ph_read():
    sensor = PHSensor("Ph sensor", "", config, "owiebhfowebfbfweoibf")
    import time
    while True:
        read = sensor.read() 
        print(read)
        time.sleep(1)

def test_cal():
  sensor = PHSensor("Ph sensor", "", config, "owiebhfowebfbfweoibf")

  db =  DatabaseHelper("src/edge_server/database/models/sessions.db")
  payload = {
      "device_id": "wodvgoeijhifh wef i",
      "sensor_id": config.get("sensor_id"), 
      "user_name": "Daniel Madalena"
  }
  calibrator = PHCalibrationManager(None, db,sensor.read, payload)
  calibrator.start()
  
  try:
      while True:
          time.sleep(1)
  except KeyboardInterrupt:
      calibrator.reset_calibration()
      print("\nExiting...")

if __name__ == "__main__": 
  get_ph_read()