import abc
import sys, os, platform
from typing import Optional

# Add project root to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from shared.models.sensor_reading import SensorReading
from shared.utils.logger import logger
from shared.utils.state_manager import StateManager
from shared.utils.config_loader import save_config

state_manager = StateManager()
# Simulation mode if explicitly set, or if not on Linux (e.g. Windows/macOS)
sim_env = os.environ.get("MAGM_SIMULATION", "false").lower() == "true"
state_manager.update_simulation_mode(sim_env or (platform.system() != "Linux"))
 
try: 
    import lgpio
    chip = lgpio.gpiochip_open(0)
except ModuleNotFoundError:
    logger.warning("GPIO module not found. Simulation mode activated!")
    from utils.RPi_sim import MockLGPIO
    lgpio = MockLGPIO()
    chip = lgpio.gpiochip_open(0)

# --- Abstract Base Class for Sensors ---

class AbstractSensor(abc.ABC):
    """
    An abstract base class that defines the common interface for all sensors.
    This ensures that any new sensor, real or simulated, will work with the manager.
    """
    def __init__(self, name: str, unit: str, config: dict , sensor_id: str):
        if not name:
            raise ValueError("Sensor name cannot be empty.")
        self.name = name
        self.unit = unit
        self.sensor_id = sensor_id
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
    
    def simulator_init(self, SimulatorClass, sensor_type):
        logger.warning(f"{self.name} sensor running in simulation mode.")
        params = self.config.get("simulator_params", {})
        self.simulated_sensor = SimulatorClass(
            name=self.name,
            unit=self.unit,
            sensor_id=self.sensor_id,
            sensor_type=sensor_type,
            config={},
            **params
        )
        
    def set_event_publisher(self, publisher_callback):
        self.event_publisher = publisher_callback
        