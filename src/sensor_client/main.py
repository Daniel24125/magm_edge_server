import platform

SIMULATION_MODE = platform.system() == "Windows"

from sensors.manager import SensorManager

import sys, os

# Add project root to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from shared.utils.config_loader import load_config


def main():
    config = load_config(os.path.join(project_root, "src/sensor_client/config/sensors.json"))
    manager = SensorManager(config)
    manager.start_acquisition_loop()


if __name__ == "__main__": 
    main()