from dataclasses import dataclass

@dataclass
class SensorReading:
    """A standard structure for returning sensor data."""
    timestamp: float
    value: float
    unit: str
    is_stable: bool
    sensor_type: str
