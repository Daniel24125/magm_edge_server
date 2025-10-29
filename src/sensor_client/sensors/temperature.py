import time
from .base import AbstractSensor, SensorReading, state_manager, lgpio

SIMULATION_MODE = state_manager.simulation_mode

if SIMULATION_MODE:
    from .simulators import SimulatedTemperatureSensor 

class TemperatureSensor(AbstractSensor):
    def __init__(self, name: str, unit: str, config: dict):
        super().__init__(name, unit, config)

        if SIMULATION_MODE:
            self.simulator_init(SimulatedTemperatureSensor)
        else:
            self.gpio_init()

    def gpio_init(self):
        lgpio.setup(self.pin, lgpio.IN)

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