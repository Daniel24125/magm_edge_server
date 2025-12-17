
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
        "min_val": 4.0,
        "max_val": 10.0,
        "period_seconds": 60,
        "noise": 0.01
      }
    }

def test_cal():
  print("Initializing Sensor...")
  sensor = PHSensor("Ph sensor", "", config, "owiebhfowebfbfweoibf")
  
  # Mock DB
  class MockDB:
      def get_last_calibration(self, key):
          return (1, 1, 0, 1, 1, 1) # dummy
      def add_record(self, table, data):
          print(f"[DB] Added record to {table}: {data}")

  db = MockDB()
  payload = {
      "device_id": "test_device",
      "sensor_id": config.get("sensor_id"), 
      "user_name": "Test User"
  }
  
  # Mock MQTT
  class MockMQTT:
      def publish(self, topic, payload, qos=0):
          print(f"[MQTT] {topic}: {payload}")

  mqtt = MockMQTT()

  print("Initializing Calibration Manager...")
  calibrator = PHCalibrationManager(mqtt, db, sensor.read, sensor.get_last_raw_average, payload)
  calibrator.start()
  
  print("Starting Calibration Loop. This will run for 30 seconds...")
  try:
      start = time.time()
      while time.time() - start < 30:
          time.sleep(1)
  except KeyboardInterrupt:
      pass
  finally:
       calibrator.reset_calibration()
       print("\nExiting...")

if __name__ == "__main__": 
    test_cal()
