import time, statistics
import os
from ..base import AbstractSensor, SensorReading, state_manager, lgpio, chip, logger, save_config, project_root
from collections import deque


SIMULATION_MODE = state_manager.simulation_mode
if SIMULATION_MODE:
    from ..simulators import SimulatedPHSensor 
else:
    from utils.comunication import AnalogCommunication


class PHSensor(AbstractSensor):
    """
        PHController class to monitor and control the pH of an aquous solution
        args: 
            name: Name associated to the sensor. 
            unit: Measurement unit
            config: {
                acid_pump_pin: Pin in the RPi associated with the acid pump;
                base_pump_pin: Pin in the RPi associated with the base pump;
                target_ph: pH value that the user whats to reach;
                max_pump_time: maximum time in seconds that the pump/vsalve will be open;
                margin: the pH margin in wich the controller will accept the pH value;
                mode: controller mode. Possible values: 
                    acidic: only connects to the acidic pump and only actuates if the pH is above the target pH;
                    alkaline: only connects to the base pump and only actuates if the pH is below the target pH;
                    auto: connects to both the acidic and base pumps and actuates if the pH is above or below the target pH;
            }
    """
    
    is_running = False
    is_pumping_acid = False
    is_pumping_base = False

    def __init__(self, name: str, unit: str, config: dict, sensor_id: str):
        super().__init__(name, unit, config, sensor_id)
        self.config = config
        self.init_read_settings()
        if SIMULATION_MODE:
            self.simulator_init(SimulatedPHSensor)
        else:
            self.init_gpio()
            self.analog_comunicator = AnalogCommunication(self.config)
        
    def init_read_settings(self):
        self.window = self.config.get("read_window_size")
        self.stability_threshold = self.config.get("read_stability_threshold")

        self.values = deque(maxlen=self.window)
        self.last_stable = False

    def init_gpio(self):  
        print("Setting GPIO mode.")
        self.acidic_pin = self.config.get("pin").get("acidic")
        self.alkaline_pin = self.config.get("pin").get("alkaline")
        lgpio.gpio_claim_output(chip, self.acidic_pin, level=1)
        lgpio.gpio_claim_output(chip, self.alkaline_pin, level=1)

    
    def read(self) -> SensorReading:
        try:
            if SIMULATION_MODE and self.simulated_sensor:
                return self.simulated_sensor.read()
            else:
                return self.get_instrument_read() 
        except Exception as err: 
            logger.error(err)

    def get_instrument_read(self):
        for i in range(10):
            ph_val = self.analog_comunicator.get_read() 
            self.values.append(ph_val)

        is_stable = False
        avg_ph = ph_val

        if len(self.values) == self.values.maxlen:
            delta = max(self.values) - min(self.values)
            is_stable = delta < self.stability_threshold
            avg_ph = statistics.mean(self.values)

        self.last_stable = is_stable
        return SensorReading(
            timestamp=time.time(),
            value=avg_ph,
            unit=self.unit,
            is_stable=is_stable
        )

    def set_mode(self, mode):
        if mode != "acidic" or mode != "alkaline" or mode != "auto":
            raise NameError("You are trying to set the controller mode to an invalid mode. Available options: acidic | alkaline | auto")
        self.mode = mode
    
####### UTIL METHODS ###########

    def calculate_pump_time(self, current_ph):
        ph_difference = abs(self.target_ph - current_ph)
        # Scale the pump time based on pH difference, max 10 seconds
        pump_time = min(ph_difference * 2, self.max_pump_time)
        return pump_time

    def determine_pump(self, current_ph):
        is_acidic = current_ph < self.target_ph ## if the solution is acidic, you need to pump a base solution
        define_base_pump = self.mode == "alkaline" or self.mode == "auto"
        define_acid_pump = self.mode == "acidic" or self.mode == "auto"

        if is_acidic and define_base_pump:
            logger.info("Base pump activated!")
            pump_pin = self.alkaline_pin
            pump = "alkaline"
        elif not is_acidic and define_acid_pump:
            logger.info("Acidic pump activated!")
            pump_pin = self.acidic_pin
            pump = "acidic"
        else:
            return  # pH is at target, no adjustment needed
        return (pump, pump_pin)


   
