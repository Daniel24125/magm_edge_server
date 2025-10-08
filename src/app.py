import time
import json
from pathlib import Path
from typing import Dict, Any
from config.config_manager import config
from core.sensor_management import SensorManager


def main():
    """
    The main entry point for the edge server application.
    """
    print("--- Starting Microalgae Edge Server ---")
    # Load configuration

    server_settings = config.get("server_settings", {})
    read_interval = server_settings.get("read_interval_seconds", 1)

    # Initialize the sensor manager
    # This manager will create and manage all sensor instances based on the config
    print("Initializing sensor manager...")
    try:
        sensor_manager = SensorManager(config.get("sensors", []))
        print(f"Found and initialized {len(sensor_manager.sensors)} active sensors.")

    except (ValueError, KeyError) as e:
        print(f"ERROR: Failed to initialize SensorManager: {e}")
        exit(1)
        
        if not sensor_manager.sensors:
            print("WARNING: No enabled sensors found in configuration. Exiting.")
            exit(0)

    # Main application loop
    print(f"\nStarting main loop. Reading sensors every {read_interval} seconds.")
    print("Press Ctrl+C to exit.")
    try:
        while True:
            # 1. Read data from all sensors
            all_readings = sensor_manager.read_all_sensors()

            print("\n--- Sensor Readings ---")
            for sensor_name, reading in all_readings.items():
                if reading:
                    # Format the value to 2 decimal places for cleaner output
                    formatted_value = f"{reading.value:.2f}"
                    print(f"  {sensor_name}: {formatted_value} {reading.unit}")
                else:
                    print(f"  {sensor_name}: Failed to read sensor.")
            
            # In a real application, this is where you would:
            # 2. Store the data using the StorageManager
            # 3. Attempt to upload the data using the Uploader

            time.sleep(read_interval)

    except KeyboardInterrupt:
        print("\n--- Shutting Down Server ---")
    finally:
        print("Server shutdown complete.")


if __name__ == "__main__":
    main()
