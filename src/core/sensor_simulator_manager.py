import sys
import os

# Calculate the path to the project root: 
# /src/simulators/sensors.py -> /src/simulators -> /src -> /project_root
# This path calculation finds the directory two levels up from the script's location.
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# Insert the project root path at the beginning of the search path
# This makes the 'config' folder (which is in the project root) importable.
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

print(f"Project root added to sys.path: {PROJECT_ROOT}")

# --- Import the configuration ---
from config.config_manager import config
    
import abc
import time
import math
import random
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
# --- Data Structures ---

@dataclass
class SensorReading:
    """A standard structure for returning sensor data."""
    timestamp: float
    value: float
    unit: str


# --- Abstract Base Class for Sensors ---

class AbstractSensor(abc.ABC):
    """
    An abstract base class that defines the common interface for all sensors.
    This ensures that any new sensor, real or simulated, will work with the manager.
    """
    def __init__(self, name: str, unit: str):
        if not name:
            raise ValueError("Sensor name cannot be empty.")
        self.name = name
        self.unit = unit

    @abc.abstractmethod
    def read(self) -> Optional[SensorReading]:
        """
        Read the current value from the sensor.

        Returns:
            A SensorReading object on success, or None on failure.
        """
        raise NotImplementedError


# --- Simulator Implementations ---

class SimulatedCyclicalSensor(AbstractSensor):
    """
    A sensor simulator that generates data in a cyclical (sine wave) pattern.
    This is useful for simulating environmental data like temperature, which
    often follows daily cycles.
    """
    def __init__(self, name: str, unit: str, min_val: float, max_val: float, period_seconds: int, noise: float):
        super().__init__(name, unit)
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
                unit=self.unit
            )
        except Exception:
            # In a real scenario, you would log this error
            return None

# --- Concrete Sensor Type Classes ---
# These classes make it easy to map config types to actual implementations.
# For now, they all use the same cyclical simulation logic.

class SimulatedTemperatureSensor(SimulatedCyclicalSensor):
    pass

class SimulatedPHSensor(SimulatedCyclicalSensor):
    pass

class SimulatedIonicStrengthSensor(SimulatedCyclicalSensor):
    pass
    
class SimulatedLightIntensitySensor(SimulatedCyclicalSensor):
    pass


# --- Sensor Manager ---

class SensorManager:
    """
    Manages all sensor objects. It is responsible for creating sensors based
    on the application configuration and for orchestrating data reads from them.
    This acts as a "Factory" for sensors.
    """
    
    # Mapping from configuration string to the actual sensor class
    SENSOR_TYPE_MAP = {
        "Temperature": SimulatedTemperatureSensor,
        "pH": SimulatedPHSensor,
        "IonicStrength": SimulatedIonicStrengthSensor,
        "LightIntensity": SimulatedLightIntensitySensor,
        # When you add a real hardware sensor, you would add it here, e.g.:
        # "DS18B20_Temperature": RealDS18B20Sensor,
    }

    def __init__(self, sensor_configs: List[Dict[str, Any]]):
        self.sensors: List[AbstractSensor] = []
        self._initialize_sensors(sensor_configs)

    def _initialize_sensors(self, sensor_configs: List[Dict[str, Any]]):
        """
        Parses the sensor configuration list and creates instances of sensors.
        """
        for config in sensor_configs:
            if not config.get("enabled", False):
                continue

            sensor_type = config.get("type")
            sensor_class = self.SENSOR_TYPE_MAP.get(sensor_type)

            if not sensor_class:
                print(f"Warning: Unknown sensor type '{sensor_type}' in config. Skipping.")
                continue

            try:
                # The parameters for the sensor are in the 'simulator_params' dict
                params = config.get("simulator_params", {})
                sensor_instance = sensor_class(
                    name=config["name"],
                    unit=config["unit"],
                    **params
                )
                self.sensors.append(sensor_instance)
            except (TypeError, KeyError, ValueError) as e:
                # This catches missing keys or invalid values during sensor creation
                raise ValueError(f"Failed to create sensor '{config.get('name')}': {e}")


    def read_all_sensors(self) -> Dict[str, Optional[SensorReading]]:
        """
        Reads data from all managed sensors and returns it in a dictionary.

        Returns:
            A dictionary mapping sensor names to their SensorReading objects.
        """
        return {sensor.name: sensor.read() for sensor in self.sensors}

if __name__ == "__main__":
    print(config)