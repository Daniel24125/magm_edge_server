import time
from .base import AbstractSensor, SensorReading, state_manager, GPIO

SIMULATION_MODE = state_manager.simulation_mode
if SIMULATION_MODE:
    from .simulators import SimulatedPHSensor 

class PHSensor(AbstractSensor):
    def __init__(self, name: str, unit: str, config: dict):
        super().__init__(name, unit, config)
        
        if SIMULATION_MODE:
            self.simulator_init(SimulatedPHSensor)
        else:
            self.gpio_init()
    
    def gpio_init(self):
        GPIO.setup(self.pin, GPIO.IN)

   
    def read(self) -> SensorReading:
        if SIMULATION_MODE and self.simulated_sensor:
            return self.simulated_sensor.read()
        else:
            value = 10
            return SensorReading(
                timestamp=time.time(),
                value=value,
                unit=self.unit
            )