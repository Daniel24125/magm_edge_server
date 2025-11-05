from .base import AbstractSensor, SensorReading
import time
import math
import random
from typing import Optional


# --- Simulator Implementations ---

class SimulatedCyclicalSensor(AbstractSensor):
    """
    A sensor simulator that generates data in a cyclical (sine wave) pattern.
    This is useful for simulating environmental data like temperature, which
    often follows daily cycles.
    """
    def __init__(self, name: str, unit: str, sensor_id: str, min_val: float, max_val: float, period_seconds: int, noise: float, config:dict={}):
        super().__init__(name, unit, sensor_id=sensor_id, config=config)
        if min_val >= max_val:
            raise ValueError("min_val must be less than max_val")
        if period_seconds <= 0:
            raise ValueError("period_seconds must be positive")
            
        self.min_val = min_val
        self.max_val = max_val
        self.period_seconds = period_seconds
        self.noise = noise
        
        self._amplitude = (max_val - min_val) / 2
        self._baseline = min_val + self._amplitude
        self._start_time = time.time()

    def read(self) -> Optional[SensorReading]:
        """
        Generates a simulated reading based on a sine wave plus random noise.
        """
        try:
            elapsed_time = time.time() - self._start_time
            
            # Calculate the cyclical component (sine wave)
            # This creates a smooth oscillation between -1 and 1
            cycle_position = (elapsed_time % self.period_seconds) / self.period_seconds
            raw_sine_value = math.sin(cycle_position * 2 * math.pi)
            
            # Scale the sine wave to our min/max values
            cyclical_value = self._baseline + raw_sine_value * self._amplitude
            
            # Add some random noise to make it more realistic
            noise_value = random.uniform(-self.noise, self.noise)
            final_value = cyclical_value + noise_value
            
            # Ensure the value stays within the min/max bounds after adding noise
            final_value = max(self.min_val, min(self.max_val, final_value))
            
            return SensorReading(
                timestamp=time.time(),
                value=final_value,
                unit=self.unit,
                is_stable=True
            )
        except Exception:
            # In a real scenario, you would log this error
            return None
        


class SimulatedTemperatureSensor(SimulatedCyclicalSensor):
    pass

class SimulatedPHSensor(SimulatedCyclicalSensor):
    pass

