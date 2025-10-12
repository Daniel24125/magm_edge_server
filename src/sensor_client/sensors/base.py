import abc
import sys, os
from typing import Optional
# Add project root to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from shared.models.sensor_reading import SensorReading
 
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

