import time, os, glob, threading
from typing import Optional
from .base import AbstractSensor, SensorReading, state_manager, lgpio, logger

SIMULATION_MODE = state_manager.simulation_mode

if SIMULATION_MODE:
    from .simulators import SimulatedTemperatureSensor 

class TemperatureSensor(AbstractSensor):
    def __init__(self, name: str, unit: str, config: dict, sensor_id: str):
        super().__init__(name, unit, config, sensor_id)
        self.key = "temp"
        self._latest_reading = None
        self._lock = threading.Lock()
        self._stop_event = threading.Event()

        if SIMULATION_MODE:
            self.simulator_init(SimulatedTemperatureSensor, "Temperature")
        else:
            self.gpio_init()
            # Start background sampling thread
            self._sampling_thread = threading.Thread(target=self._sampling_loop, daemon=True)
            self._sampling_thread.start()
            logger.info(f"Temperature sensor background sampling started.")

    def gpio_init(self) -> bool:
        # Initialize 1-Wire device
        self.device_file = None
        base_dir = '/sys/bus/w1/devices/'
        
        try:
            specified_id = self.config.get("onewire_id")
            if specified_id:
                folder = os.path.join(base_dir, specified_id)
            else:
                # Auto-detect
                folders = glob.glob(base_dir + '28*')
                if folders:
                    folder = folders[0]
                else:
                    logger.warning("No DS18B20 sensor found!")
                    folder = None

            if folder:
                self.device_file = os.path.join(folder, 'w1_slave')
                logger.info(f"DS18B20 Sensor found at {self.device_file}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error finding DS18B20 sensor: {e}")
            return False

    def _sampling_loop(self):
        while not self._stop_event.is_set():
            try:
                temp_c = self._read_from_hardware()
                if temp_c is not None:
                    # Apply Unit Conversion
                    final_val = temp_c
                    if self.unit.lower() in ["fahrenheit", "f"]:
                        final_val = (temp_c * 9/5) + 32
                    
                    with self._lock:
                        self._latest_reading = SensorReading(
                            timestamp=time.time(),
                            value=final_val,
                            unit=self.unit,
                            sensor_type="Temperature",
                            is_stable=True
                        )
                    # Once we have a valid reading, we can follow the normal sampling interval
                    time.sleep(2)
                else:
                    # If we didn't get a valid reading (e.g. 85.0 reset value), retry faster
                    time.sleep(1)
            except Exception as e:
                logger.error(f"Error in temperature sampling loop: {e}")
                time.sleep(2)

    def _read_from_hardware(self) -> Optional[float]:
        if not self.device_file or not os.path.exists(self.device_file):
            return None
        
        try:
            with open(self.device_file, 'r') as f:
                lines = f.readlines()
            
            # Parse the W1-GPIO output
            if not lines or len(lines) < 2 or lines[0].strip()[-3:] != 'YES':
                 return None
            
            equals_pos = lines[1].find('t=')
            if equals_pos != -1:
                temp_string = lines[1][equals_pos+2:]
                temp_c = float(temp_string) / 1000.0
                
                # Check for 85.0 power-on reset error
                if temp_c == 85.0:
                    logger.warning("DS18B20 returned 85.0°C (Reset value).")
                    return None
                return temp_c
            return None
        except Exception as e:
            logger.error(f"Error reading raw temp: {e}")
            return None

    def read(self) -> Optional[SensorReading]:
        if SIMULATION_MODE and self.simulated_sensor:
            return self.simulated_sensor.read()
        
        with self._lock:
            return self._latest_reading

    def stop(self):
        self._stop_event.set()