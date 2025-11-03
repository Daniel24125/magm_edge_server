import  sys, os
from .ph.ph import PHSensor
from .temperature import TemperatureSensor
from .base import AbstractSensor
from typing import List, Dict, Any, Optional, Union

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


from shared.models.sensor_reading import SensorReading

# --- Sensor Manager ---

class SensorManager:
    """
    Manages all sensor objects. It is responsible for creating sensors based
    on the application configuration and for orchestrating data reads from them.
    This acts as a "Factory" for sensors.
    """
    
    # Mapping from configuration string to the actual sensor class
    SENSOR_TYPE_MAP = {
        "Temperature": TemperatureSensor,
        "pH": PHSensor,
    }

    def __init__(self, config: List[Dict[str, Any]]):
        self.sensors: List[AbstractSensor] = []
        self.config = config
        self._initialize_sensors()

    def _initialize_sensors(self):
        """
        Parses the sensor configuration list and creates instances of sensors.
        """
        for sensor in self.config.get("sensors"):
            if sensor.get("enabled"):
                sensor_class = self.SENSOR_TYPE_MAP[sensor.get("type")]
                self.sensors.append(
                    sensor_class(
                        name = sensor.get("name"), 
                        unit = sensor.get("unit"), 
                        config = sensor
                    )
                )

    def read_all_sensors(self) -> Dict[str, Optional[SensorReading]]:
        """
        Reads data from all managed sensors and returns it in a dictionary.

        Returns:
            A dictionary mapping sensor names to their SensorReading objects.
        """
        return {sensor.name: sensor.read() for sensor in self.sensors}

    def get_sensor(self, sensor_id: str) -> Union[PHSensor, TemperatureSensor]: 
        return list(filter(lambda s: s.get("sensor_id", "") == sensor_id))[0]

if __name__ == "__main__": 
    from shared.utils.config_loader import load_config
    config = load_config(os.path.join(PROJECT_ROOT, "sensor_client/config/sensors.json"))
    ph_config = filter(lambda s: s.get("type") == "pH", config.get("sensors"))
    list_config = list(ph_config)[0]
    manager = SensorManager(
        config=list_config
    )