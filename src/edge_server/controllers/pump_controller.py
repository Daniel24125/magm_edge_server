import json
import time
from datetime import datetime, timezone
from typing import Dict, Any

from shared.utils.logger import logger

class PumpController:
    def __init__(self, device_controller, alert_manager):
        self.device_controller = device_controller
        self.alert_manager = alert_manager
        self.last_pump_activation = 0

    def evaluate_ph_control(self, device_id: str, data: Dict[str, Any], active_session: Dict[str, Any], session_id: str, paused: bool):
        """
        Implements proportional pH control:
        - "Pump more acid/base if the difference between read and setpoint is higher"
        - "Apply a max pump time... adjustable by the user"
        """
        if paused:
            return

        # Check if pH data is present
        # Data structure example: {"ph": {"value": 7.1, ...}}
        ph_data = data.get("ph") or data.get("PH")
        if not ph_data or not isinstance(ph_data, dict):
            return
        
        try:
            current_ph = float(ph_data.get("value"))
        except (TypeError, ValueError):
            return

        # Get Settings
        settings = json.loads(active_session.get("settings", "{}"))
        if not settings.get("phControl"):
            return

        target_ph = float(settings.get("phSetPoint", 7.0))
        max_pump_time = float(settings.get("maxPumpTime", 2.0))
        
        # Deadband and Cooldown
        if time.time() - self.last_pump_activation < 5: # 5s cooldown
            return
            
        error = current_ph - target_ph
        if abs(error) < 0.1: # Deadband
            return

        # Proportional Control Calculation
        # Heuristic: If error is 1.0 (large), pump for full max_pump_time.
        # If error is small (0.2), pump for fraction.
        # Kp = max_pump_time / 1.0 => duration = abs(error) * max_pump_time
        # This ensures we hit max pump time at 1.0 pH difference.
        
        calculated_duration = abs(error) * max_pump_time
        duration = min(calculated_duration, max_pump_time)
        
        if duration < 0.1: # Minimum pump time
            return

        pump_type = "acidic" if error > 0 else "alkaline"
        
        logger.info(f"pH Control: pH={current_ph}, Target={target_ph}, Error={error:.2f}. Pumping {pump_type} for {duration:.2f}s")
        
        # Execute Command
        cmd_payload = {
            "device_id": device_id,
            "pump_type": pump_type,
            "duration": round(duration, 2)
        }
        
        # Using device_controller to forward command
        if self.device_controller:
            self.device_controller.forward_device_command(cmd_payload, "pump_control")
            self.last_pump_activation = time.time()

            # Alert: Pump Activated
            self.alert_manager.send_session_alert(
                session_id=session_id,
                device_id=device_id,
                sensor_type="ph_control",
                value=duration,
                message=f"The {pump_type} pump was activated during {duration:.2f} seconds",
                severity="info",
                timestamp=datetime.now(timezone.utc).isoformat()
            )
