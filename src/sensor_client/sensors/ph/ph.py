import time, statistics, threading
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
        self.values = deque(maxlen=self.read_window_size)
        self.raw_values = deque(maxlen=self.read_window_size)
        
        # Stability History (Longer term)
        self.history = deque(maxlen=20) 
        
        # Current State
        self._current_reading = None
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        
        if SIMULATION_MODE:
            self.simulator_init(SimulatedPHSensor, "pH")
        else:
            self.analog_comunicator = AnalogCommunication(config)
            
        # Start Background Sampling
        self._sampling_thread = threading.Thread(target=self._sampling_loop, daemon=True)
        self._sampling_thread.start()

    def read(self) -> SensorReading:
        with self._lock:
            if self._current_reading:
                return self._current_reading
            
            # Fallback if no reading yet (should happen briefly at start)
            return SensorReading(
                timestamp=time.time(),
                value=7.0, 
                unit=self.unit,
                is_stable=False,
                sensor_type="pH"
            )

    def _sampling_loop(self):
        logger.info("pH Sensor Sampling Loop started")
        while not self._stop_event.is_set():
            try:
                self._sample_once()
            except Exception as e:
                logger.error(f"Error in pH sampling loop: {e}")
            time.sleep(0.5) # Sampling rate (2Hz)

    def _sample_once(self):
        val = 7.0
        
        if SIMULATION_MODE and self.simulated_sensor:
            # In sim mode, read from simulator
            read_obj = self.simulated_sensor.read()
            val = read_obj.value
        else:
            # Real Hardware Read
            raw_val = self.analog_comunicator.get_analog_read()
            self.raw_values.append(raw_val)
            val = self.analog_comunicator.convert_analog(raw_val)

        # Update buffers
        self.values.append(val)
        
        # Calculate Average
        if len(self.values) > 0:
            avg_ph = statistics.mean(self.values)
        else:
            avg_ph = val

        # Update History & Stability
        # We append to history less frequently? No, let's append every sample but use history for slope.
        # Original logic used distinct 'history' buffer updated once per read() call.
        # Here we update history every sample cycle.
        self.history.append((time.time(), avg_ph))
        
        is_stable = self._calculate_stability()
        self.last_stable = is_stable
        
        # Update Controller
        self.controller.update_reading(avg_ph, is_stable)
        
        # Cache Reading
        with self._lock:
            self._current_reading = SensorReading(
                timestamp=time.time(),
                value=avg_ph,
                unit=self.unit,
                is_stable=is_stable,
                sensor_type="pH"
            )

    def _calculate_stability(self):
        if len(self.history) < 5:
            return False
            
        timestamps = np.array([x[0] for x in self.history])
        ph_values = np.array([x[1] for x in self.history])
        
        # Normalize timestamps to avoid large numbers
        timestamps -= timestamps[0]
        
        # Linear Regression (Slope)
        slope, _ = np.polyfit(timestamps, ph_values, 1)
        
        # Stability check
        return abs(slope) < self.drift_stability_threshold

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
    def test_pump(self, pump_type, duration=1.0, bypass_limit=False):
        self.controller.test_pump(pump_type, duration, bypass_limit)

    # Helper for Calibration
    def get_last_raw_average(self):
        if not self.raw_values: 
             return 0
        return statistics.mean(self.raw_values)
        
    def set_event_publisher(self, publisher_callback):
        super().set_event_publisher(publisher_callback)
        self.controller.set_event_callback(publisher_callback)