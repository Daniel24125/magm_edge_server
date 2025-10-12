import time
import json
from pathlib import Path
from typing import Dict, Any
from config.config_manager import config
from data_aquisition.sensor_management import SensorManager


def main():
    """
    The main entry point for the edge server application.
    """
    
    print("--- Starting Microalgae Edge Server ---")
    try:

        settings = filter( lambda sensor: sensor.get("enabled"), config.get("sensors", []))
        sensor_manager = SensorManager(settings)
        print(f"Found and initialized {len(sensor_manager.sensors)} active sensors.")
        sensor_manager.initialize_aquisition_loop(config)


    except (ValueError, KeyError) as e:
        print(f"ERROR: Failed to initialize SensorManager: {e}")
        exit(1)
        
        if not sensor_manager.sensors:
            print("WARNING: No enabled sensors found in configuration. Exiting...")
            exit(0)
    except KeyboardInterrupt:
        print("\n--- Shutting Down Server ---")
    finally:
        print("Server shutdown complete.")
   

if __name__ == "__main__":
    main()
