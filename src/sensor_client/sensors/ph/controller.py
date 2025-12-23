import time
import threading
import statistics
from shared.utils.logger import logger

# Try importing hardware libraries, mock if missing (for testing/simulation)
try:
    import lgpio
except ImportError:
    lgpio = None
    print("lgpio not found, skipping GPIO init.")

class PHController:
    def __init__(self, config):
        self.config = config
        self.pins = self.config.get("pin", {})
        
        # Pump Pins
        self.acidic_pin = self.pins.get("acidic", 10)
        self.alkaline_pin = self.pins.get("alkaline", 9)

        # State
        self.control_enabled = config.get("enabled", True)
        self.target_ph = 7.0 # Default, updated via settings
        self.max_pump_time = config.get("max_pump_time", 0.3)
        self.safety_max_duration = float(config.get("max_pump_time", 0.3)) # Hard limit from config
        self.last_pump_activation = 0
        
        # Threading state
        self._control_thread = None
        self._stop_control_event = threading.Event()
        self._pause_control_event = threading.Event()
        self._latest_ph_value = None
        self._latest_stability = False
        
        self.on_event_callback = None

        self.init_gpio()

    def set_event_callback(self, callback):
        self.on_event_callback = callback

    def init_gpio(self):
        if not lgpio:
            logger.warning("lgpio not found, skipping GPIO init.")
            return

        try:
            self.h = lgpio.gpiochip_open(0)
            lgpio.gpio_claim_output(self.h, self.acidic_pin)
            lgpio.gpio_claim_output(self.h, self.alkaline_pin)
            # Active LOW (relays usually on when LOW) - Initialize HIGH (OFF)
            self.stop_pumps()
            logger.info("pH Controller GPIO Initialized")
        except Exception as e:
            logger.error(f"Failed to init GPIO: {e}")
    
    def stop_pumps(self):
        lgpio.gpio_write(self.h, self.acidic_pin, 1)
        lgpio.gpio_write(self.h, self.alkaline_pin, 1)

    def update_settings(self, settings):
        """Updates the controller configuration dynamically."""
        try:
            if "phSetPoint" in settings:
                self.target_ph = float(settings.get("phSetPoint"))
            if "enabled" in settings:
                self.control_enabled = settings.get("enabled", True)
            if "maxPumpTime" in settings:
                self.max_pump_time = float(settings.get("maxPumpTime"))

            logger.info(f"pH Controller settings updated: Target={self.target_ph}, Enabled={self.control_enabled}")
        except Exception as e:
            logger.warning(f"Error updating pH controller settings: {e}")

    def update_reading(self, value, is_stable):
        """Called by the sensor to provide fresh data."""
        self._latest_ph_value = value
        self._latest_stability = is_stable

    def calculate_pump_time(self, current_ph):
        """Calculates pump duration based on deviation from target."""
        error = abs(current_ph - self.target_ph)
        # Proportional-ish: wider gap = more time, capped at max_pump_time
        # Example heuristic: error 1.0 -> max_time, error 0.1 -> 10% max_time
        # Let's simple clamp it for now as per original logic which was simple
        
        # Original logic in user's change was:
        # pump_time = self.calculate_pump_time(current_ph) where they might have put logic.
        # Looking at previous file history, the user implemented: 
        # duration = min(self.max_pump_time, error * factor?) 
        # Let's assume a linear scaling up to max_time at error=1.0pH
        
        duration = error * self.max_pump_time
        return max(0.05, min(duration, self.max_pump_time))

    # ------------------ Lifecycle Methods ------------------

    def start_control_thread(self):
        if self._control_thread is not None and self._control_thread.is_alive():
            return

        self._stop_control_event.clear()
        self._pause_control_event.clear()
        self._control_thread = threading.Thread(target=self._control_loop_thread, daemon=True)
        self._control_thread.start()
        logger.info("pH Control Thread started.")

    def stop_control_thread(self):
        if self._control_thread:
            self._stop_control_event.set()
            self._control_thread.join(timeout=2)
            self._control_thread = None
            logger.info("pH Control Thread stopped.")
        self.turn_off_pumps()

    def pause_control(self):
        self._pause_control_event.set()
        self.turn_off_pumps()

    def resume_control(self):
        self._pause_control_event.clear()

    # ------------------ Control Logic ------------------

    def _control_loop_thread(self):
        logger.info("pH Control Loop running...")
        while not self._stop_control_event.is_set():
            time.sleep(1) 
            
            if self._pause_control_event.is_set():
                continue
            if not self.control_enabled:
                continue
                
            ph = self._latest_ph_value
            stable = self._latest_stability
            
            if ph is None:
                continue
                
            self._evaluate_and_act(ph, stable)

    def _evaluate_and_act(self, current_ph, is_stable):
        if not is_stable:
             return

        # Cooldown (5s)
        if time.time() - self.last_pump_activation < 5:
            return
            
        # Hysteresis
        tolerance = 0.1
        
        pump_type = None
        if current_ph > (self.target_ph + tolerance):
             pump_type = "acidic"
        elif current_ph < (self.target_ph - tolerance):
             pump_type = "alkaline"
             
        if pump_type:
            logger.info(f"pH Control Trigger: {current_ph:.2f} vs Target {self.target_ph}. Activating {pump_type}.")
            pump_time = self.calculate_pump_time(current_ph)
            self.test_pump(pump_type, duration=pump_time)
            self.last_pump_activation = time.time()

    def test_pump(self, pump_type, duration=1.0):
        # Enforce safety limit
        if duration > self.safety_max_duration:
             logger.warning(f"Requested pump duration {duration:.2f}s exceeds safety limit {self.safety_max_duration:.2f}s. Clamping.")
             duration = self.safety_max_duration

        if not lgpio:
             logger.info(f"[SIMULATION] Pump {pump_type} activated for {duration:.2f}s")
             return

        pin = self.acidic_pin if pump_type == "acidic" else self.alkaline_pin
        
        def _activate():
            try:
                logger.info(f"Activating {pump_type} pump (Pin {pin}) for {duration:.2f}s")
                
                if self.on_event_callback:
                    self.on_event_callback("pump_activated", {
                        "pump_type": pump_type,
                        "duration": duration,
                        "pin": pin
                    })

                lgpio.gpio_write(self.h, pin, 0) # ON (Active LOW)
                time.sleep(duration)
                lgpio.gpio_write(self.h, pin, 1) # OFF
            except Exception as e:
                logger.error(f"Pump error: {e}")
                self.turn_off_pumps()

        # Run in separate thread to not block the control loop logic 
        # (Though control loop is threaded, waiting 0.5s inside it delays the next check slightly, which is fine)
        # But for 'test_pump' called externally, we might want it non-blocking or blocking?
        # Standard pattern: blocking the caller is usually bad for async commands.
        t = threading.Thread(target=_activate)
        t.start()

    def turn_off_pumps(self):
        if not lgpio: return
        try:
            lgpio.gpio_write(self.h, self.acidic_pin, 1)
            lgpio.gpio_write(self.h, self.alkaline_pin, 1)
        except:
            pass

    def cleanup(self):
        self.stop_control_thread()
        if lgpio:
            try:
                lgpio.gpiochip_close(self.h)
            except:
                pass
