import time
from ..base import AbstractSensor, SensorReading, state_manager, GPIO
from utils.comunication import AnalogCommunication

SIMULATION_MODE = state_manager.simulation_mode
if SIMULATION_MODE:
    from ..simulators import SimulatedPHSensor 

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
    analog_comunicator = AnalogCommunication("ph/calibration.json")

    def __init__(self, name: str, unit: str, config: dict):
        super().__init__(name, unit, config)
        
        if SIMULATION_MODE:
            self.simulator_init(SimulatedPHSensor)
        else:
            self.gpio_init()
    
    def gpio_init(self):
        GPIO.setup(self.pin, GPIO.IN)

   
    def read(self) -> SensorReading:
        if SIMULATION_MODE and self.simulated_sensor:
            return self.simulated_sensor.read()
        else:
            value = 10
            return SensorReading(
                timestamp=time.time(),
                value=value,
                unit=self.unit
            )