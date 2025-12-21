import sys, os
import unittest
from unittest.mock import MagicMock

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from mqtt_client import MQTTClient

class TestMQTTClientRefactor(unittest.TestCase):
    def test_instantiation(self):
        # Mock dependencies
        sensor_manager_mock = MagicMock()
        mqtt_config = {"mqtt": {"broker": "localhost", "port": 1883, "keepalive": 60}}
        
        # Instantiation
        try:
            client = MQTTClient(mqtt_config, sensor_manager_mock)
            print("MQTTClient instantiated successfully")
            
            self.assertTrue(hasattr(client, 'device_parser'), "device_parser attribute missing")
            self.assertTrue(hasattr(client, 'session_parser'), "session_parser attribute missing")
            
            print(f"Device Parser: {client.device_parser}")
            print(f"Session Parser: {client.session_parser}")
            
        except Exception as e:
            self.fail(f"Instantiation failed with error: {e}")

if __name__ == "__main__":
    unittest.main()
