import time, statistics
from ..base import AbstractSensor, SensorReading, state_manager, lgpio, chip, logger
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
        self.key = "ph"
        self.config = config
        self.init_read_settings()
        if SIMULATION_MODE:
            self.simulator_init(SimulatedPHSensor, "pH")
        else:
            self.init_gpio()
            self.analog_comunicator = AnalogCommunication(self.config)
        
    def init_read_settings(self):
        self.window = self.config.get("read_window_size")
        self.stability_threshold = self.config.get("read_stability_threshold")

        self.values = deque(maxlen=self.window)
        self.last_stable = False

    def init_gpio(self):  
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
            sigma = statistics.stdev(self.values)
            is_stable = sigma < self.stability_threshold
            avg_ph = statistics.mean(self.values)

        self.last_stable = is_stable
        return SensorReading(
            timestamp=time.time(),
            value=avg_ph,
            unit=self.unit,
            is_stable=is_stable,
            sensor_type="pH"
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

    def test_pump(self, pump_type: str, duration: float):
        """Manually activate a pump for a specific duration."""
        if pump_type not in ["acidic", "alkaline"]:
            logger.error(f"Invalid pump type: {pump_type}")
            return

        pin = self.acidic_pin if pump_type == "acidic" else self.alkaline_pin
        logger.info(f"Testing {pump_type} pump on pin {pin} for {duration}s")
        
        import threading
        def run():
            if SIMULATION_MODE:
                logger.info(f"[SIMULATION] Pump {pump_type} ON")
                time.sleep(duration)
                logger.info(f"[SIMULATION] Pump {pump_type} OFF")
            else:
                try:
                    # Assuming active LOW (init was 1)
                    lgpio.gpio_write(chip, pin, 0) 
                    time.sleep(duration)
                except Exception as e:
                    logger.error(f"Error controlling pump: {e}")
                finally:
                    lgpio.gpio_write(chip, pin, 1) # Ensure OFF
        
        threading.Thread(target=run, daemon=True).start()


   
if __name__ == "__main__": 
    config = {
      "key": "ph",
      "type": "pH",
      "name": "pH Sensor 1",
      "sensor_id": "e6cc7497-d0aa-4cd9-9e56-578b6f9db521",
      "unit": "",
      "enabled": True,
      "probe": 3,
      "read_window_size": 10,
      "read_stability_threshold": 0.02,
      "pin":{
          "acidic": 10,
          "alkaline": 9,
          "alkaline_pump_pin": 10, 
          "acidic_pump_pin": 10
      },
      "simulator_params": {
        "min_val": 6.0,
        "max_val": 8.5,
        "period_seconds": 43200,
        "noise": 0.05
      }
    }
    sensor = PHSensor("Ph sensor", "", config, "owiebhfowebfbfweoibf")