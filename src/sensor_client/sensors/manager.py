import time, sys, os
from .ph import PHSensor
from .temperature import TemperatureSensor
from typing import List, Dict, Any, Optional
from .base import AbstractSensor

# Add project root to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)


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

    def start_acquisition_loop(self):
        aquisition_settings = self.config.get("sampling", {})
        read_interval = aquisition_settings.get("sensor_interval", 1)

        print(f"\nStarting main loop. Reading sensors every {read_interval} seconds.")
        print("Press Ctrl+C to exit.")
        while True:
            all_readings = self.read_all_sensors()
            print("\n--- Sensor Readings ---")
            for sensor_name, reading in all_readings.items():
                if reading:
                    formatted_value = f"{reading.value:.2f}"
                    print(f"  {sensor_name}: {formatted_value} {reading.unit}")
                else:
                    print(f"  {sensor_name}: Failed to read sensor.")
            time.sleep(read_interval)