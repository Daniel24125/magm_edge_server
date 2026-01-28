import time, os, glob
from .base import AbstractSensor, SensorReading, state_manager, lgpio, logger

SIMULATION_MODE = state_manager.simulation_mode

if SIMULATION_MODE:
    from .simulators import SimulatedTemperatureSensor 

class TemperatureSensor(AbstractSensor):
    def __init__(self, name: str, unit: str, config: dict, sensor_id: str):
        super().__init__(name, unit, config, sensor_id)
        self.key = "temp"

        if SIMULATION_MODE:
            self.simulator_init(SimulatedTemperatureSensor, "Temperature")
        else:
            self.gpio_init()

    def gpio_init(self):
        # Initialize 1-Wire device
        # If onewire_id is specified in config, use it. Otherwise auto-detect 28-*
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
                
        except Exception as e:
            logger.error(f"Error finding DS18B20 sensor: {e}")

    def read_temp_raw(self):
        if not self.device_file or not os.path.exists(self.device_file):
            return None
        
        try:
            with open(self.device_file, 'r') as f:
                lines = f.readlines()
            return lines
        except Exception as e:
            logger.error(f"Error reading raw temp: {e}")
            return None

    def read(self) -> SensorReading:
        if SIMULATION_MODE and self.simulated_sensor:
            reading = self.simulated_sensor.read()
            if not reading:
                return None
            temp_c = reading.value
        else:
            lines = self.read_temp_raw()
            if not lines:
                return None
                
            # Parse the W1-GPIO output
            if lines[0].strip()[-3:] != 'YES':
                 return None
            
            equals_pos = lines[1].find('t=')
            if equals_pos != -1:
                temp_string = lines[1][equals_pos+2:]
                temp_c = float(temp_string) / 1000.0
            else:
                return None

        # Check for 85.0 power-on reset error (DS18B20 specific)
        if not SIMULATION_MODE and temp_c == 85.0:
            logger.warning("DS18B20 returned 85.0°C. This is a power-on reset value. Check wiring or pull-up resistor.")
            return None

        # Apply Unit Conversion
        final_val = temp_c
        if self.unit.lower() in ["fahrenheit", "f"]:
            final_val = (temp_c * 9/5) + 32
        
        return SensorReading(
            timestamp=time.time(),
            value=final_val,
            unit=self.unit,
            sensor_type="Temperature",
            is_stable=True
        )