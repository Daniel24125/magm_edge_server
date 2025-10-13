import abc
import sys, os
from typing import Optional

try: 
    import RPi.GPIO as GPIO
    SIMULATION_MODE = False
except ImportError:
    print("GPIO module not found. Simulation mode activated!")
    SIMULATION_MODE = True
    from utils.RPi_sim import MockGPIO as GPIO

# Add project root to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from shared.models.sensor_reading import SensorReading
from shared.utils.logger import logger
 
# --- Abstract Base Class for Sensors ---

class AbstractSensor(abc.ABC):
    """
    An abstract base class that defines the common interface for all sensors.
    This ensures that any new sensor, real or simulated, will work with the manager.
    """
    def __init__(self, name: str, unit: str, config: dict = {}):
        if not name:
            raise ValueError("Sensor name cannot be empty.")
        self.name = name
        self.unit = unit
        self.config = config
        self.simulated_sensor = None
        
    def gpio_init(self):
        """
        Define the correct method to access the GPIO pins for the sensor.
        """
        raise NotImplementedError

    @abc.abstractmethod
    def read(self) -> Optional[SensorReading]:
        """
        Read the current value from the sensor.

        Returns:
            A SensorReading object on success, or None on failure.
        """
        raise NotImplementedError
    
  
    
    def simulator_init(self, SimulatorClass):
        logger.warning(f"{self.name} sensor running in simulation mode.")
        params = self.config.get("simulator_params", {})
        self.simulated_sensor = SimulatorClass(
            name=self.name,
            unit=self.unit,
            **params
        )
        