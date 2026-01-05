import json
import random
import math
from shared.utils.logger import logger

class SpectrometerController:
    """
    Handles all Spectrometer-related logic, including:
    - Configuration management
    - Measurement processing (Simulation / Forwarding)
    - Future: ML Inference for OD and CO2 extraction
    """
    def __init__(self, client):
        self.client = client

    def handle_configure(self, device_id, payload):
        """
        Updates the configuration for a specific spectrometer.
        Forwards the configuration to the actual device via MQTT.
        """
        logger.debug(f"SpectrometerController: Forwarding Config to {device_id}")
        topic = f"devices/{device_id}/commands/configure"
        self.client.publish(topic, json.dumps(payload))
        logger.debug(f"SpectrometerController: Published config to {topic}")
        
    def handle_measure(self, device_id, payload):
        """
        Trigger a measurement.
        Forwards the measure command to the actual device.
        Future: ML Inference will happen on the DATA processing side, not here.
        """
        logger.debug(f"SpectrometerController: Forwarding Measure Command to {device_id}")
        
        topic = f"devices/{device_id}/commands/measure"
        cmd_payload = {
            "command": "measure",
            "device_id": device_id,
            **payload
        }
        self.client.publish(topic, json.dumps(cmd_payload))
        logger.debug(f"SpectrometerController: Published measure command to {topic}")

