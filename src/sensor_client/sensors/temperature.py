import time
import sys, os
from .base import AbstractSensor

try: 
    import RPi.GPIO as GPIO
    SIMULATION_MODE = False

except ImportError:
    print("GPIO module not found. Simulation mode activated!")
    SIMULATION_MODE = True
    from utils.RPi_sim import MockGPIO as GPIO
    from .simulators import SimulatedTemperatureSensor 

# Add project root to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.models.sensor_reading import SensorReading



class TemperatureSensor(AbstractSensor):
    def __init__(self, name: str, unit: str, config: dict):
        super().__init__(name, unit)

        self.config = config
        self.simulated_sensor = None

        if SIMULATION_MODE:
            self.simulator_init(name, unit, config)


        else:
            self.gpio_init()
    
    def gpio_init(self):
        GPIO.setup(self.pin, GPIO.IN)

    def simulator_init(self, name: str, unit: str, config: dict):
        print(" Temperature sensor running in simulation mode.")
        params = config.get("simulator_params", {})
        self.simulated_sensor = SimulatedTemperatureSensor(
            name=name,
            unit=unit,
            **params
        )
        
    def read(self) -> SensorReading:
        if SIMULATION_MODE and self.simulated_sensor:
            return self.simulated_sensor.read()
        else:
            value = 37
            return SensorReading(
                timestamp=time.time(),
                value=value,
                unit=self.unit
            )