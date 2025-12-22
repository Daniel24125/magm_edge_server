import time, statistics
import numpy as np
from ..base import AbstractSensor, SensorReading, state_manager, logger
from collections import deque
from .controller import PHController

# Simulation imports
SIMULATION_MODE = state_manager.simulation_mode
if SIMULATION_MODE:
    from ..simulators import SimulatedPHSensor
else:
    from utils.comunication import AnalogCommunication


class PHSensor(AbstractSensor):
    def __init__(self, name: str, unit: str, config: dict, sensor_id: str):
        super().__init__(name, unit, config, sensor_id)
        self.type = "pH"
        self.key = "ph"
        self.unit = ""
        self.config = config
        
        # Sensor Specific Config
        self.read_window_size = config.get("read_window_size", 10)
        self.read_stability_threshold = config.get("read_stability_threshold", 0.01)
        self.drift_stability_threshold = config.get("drift_stability_threshold", 0.005)
        
        # Initialize Controller
        self.controller = PHController(config)
        
        # Reading Buffers
        self.history = deque(maxlen=self.read_window_size) 
        self.values = deque(maxlen=self.read_window_size)
        self.raw_values = deque(maxlen=self.read_window_size)
        
        if SIMULATION_MODE:
            self.simulator_init(SimulatedPHSensor, "pH")
        else:
            self.analog_comunicator = AnalogCommunication(config)

    def read(self) -> SensorReading:
        try:
            if SIMULATION_MODE and self.simulated_sensor:
                return self.simulated_sensor.read()
            else:
                return self.get_instrument_read() 
        except Exception as err: 
            logger.error(err)

    def get_instrument_read(self):
        # Optimized: Read 1 sample per cycle.
        for i in range(1):
            raw_val = self.analog_comunicator.get_analog_read()
            self.raw_values.append(raw_val)
            ph_val = self.analog_comunicator.convert_analog(raw_val)
            self.values.append(ph_val)
        
        is_stable = False
        avg_ph = ph_val

        if len(self.values) == self.values.maxlen:
            avg_ph = statistics.mean(self.values)
            self.history.append((time.time(), avg_ph))
            
            if len(self.history) >= 3:
                timestamps = np.array([x[0] for x in self.history])
                ph_values = np.array([x[1] for x in self.history])
                timestamps -= timestamps[0]
                slope, _ = np.polyfit(timestamps, ph_values, 1)
                is_stable = abs(slope) < self.drift_stability_threshold
            else:
                is_stable = False

        self.last_stable = is_stable
        
        # Update Controller with latest reading
        self.controller.update_reading(avg_ph, is_stable)
        
        return SensorReading(
            timestamp=time.time(),
            value=avg_ph,
            unit=self.unit,
            is_stable=is_stable,
            sensor_type="pH"
        )

    def update_control_settings(self, settings):
        """Called by SensorManager when session settings update."""
        self.controller.update_settings(settings)

    # Delegate Lifecycle to Controller
    def on_session_start(self, session_id):
        self.controller.start_control_thread()
        
    def on_session_stop(self):
        self.controller.stop_control_thread()

    def on_session_pause(self):
        self.controller.pause_control()

    def on_session_resume(self):
        self.controller.resume_control()

    # Convenience/Compatibility wrappers
    def start_control_thread(self):
        self.controller.start_control_thread()
        
    def stop_control_thread(self):
        self.controller.stop_control_thread()

    # Delegate Manual Control (for testing/DeviceParser)
    def test_pump(self, pump_type, duration=1.0):
        self.controller.test_pump(pump_type, duration)

    # Helper for Calibration
    def get_last_raw_average(self):
        if not self.raw_values: 
             return 0
        return statistics.mean(self.raw_values)