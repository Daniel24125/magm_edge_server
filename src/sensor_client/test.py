from sensors.ph.ph import PHSensor
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
        
 
if __name__ == "__main__": 
   sensor = PHSensor("Ph sensor", "", config, "owiebhfowebfbfweoibf")

   import time
   
   while True:
        read = sensor.read() 
        an_read = sensor.analog_comunicator.get_analog_read() 
        print(read.value, an_read)
        time.sleep(1)   
   