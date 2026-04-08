import os, sys, json
from datetime import datetime, timezone
from .session_controller import SessionController
from .device_controller import DeviceController
from .spectrometer_controller import SpectrometerController

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.utils.logger import logger
from edge_server.models.schemas import CommandPayload


class CommandHandler:
    """Responsible for parsing commands and dispatching them to the controller."""

    def __init__(self, client, alert_manager=None, db_helper=None):
        self.client = client
        self.db_helper = db_helper
        self.device_controller = DeviceController(client, alert_manager)
        self.session_controller = SessionController(client, device_controller=self.device_controller)
        self.spectrometer_controller = SpectrometerController(client)

    def handle_ui_command(self, payload: dict):
        logger.info(f"Received UI Command Payload: {payload}")
        if type(payload) == str:
            payload = json.loads(payload)
        try:
            cmd = CommandPayload(**payload)
        except Exception as e:
            logger.error(f"Invalid command payload: {payload} ({e})")
            return

        match cmd.command:
            case "configure_session":
                self.session_controller._handle_config_update(cmd.params)
            case "start_session":
                self.session_controller.start_session(cmd.params)
            case "ping_device":
                # self.aws._notify_user("rpi_connected", f"The edge server is connected")
                # Using alert manager would be cleaner but let's direct publish for now to match behavior
                self.client.publish("system/notifications", json.dumps({
                    "type": "app",
                    "source": "edge",
                    "event": "rpi_connected",
                    "timestamp": json.dumps(datetime.now(timezone.utc).isoformat()).strip('"'),
                    "message": "The edge server is connected"
                }))
                self.device_controller.broadcast_all_devices()
            case "stop_session":
                self.session_controller.stop_session()
            case "start_calibration":
                self.device_controller.forward_device_command(cmd.params, cmd.command)
            case "get_session_status":
                self.session_controller.publish_status()
            case "get_session_history":
                session_id = cmd.params.get("id") or self.session_controller.id
                if session_id:
                    self.session_controller.publish_history(session_id)
                else:
                    logger.warning("Received get_session_history with no ID and no active session.")
            case "pause_session":
                self.session_controller.pause_session()
            case "resume_session":
                self.session_controller.resume_session()
            case "confirm_calibration":
                device_id = cmd.params.get("device_id")
                topic = f"devices/{device_id}/cal/confirm"
                
                self.client.publish(topic, json.dumps(cmd.params))
            case "configure":
                self.spectrometer_controller.handle_configure(cmd.params.get("device_id"), cmd.params)
            case "cancel_calibration":
                device_id = cmd.params.get("device_id")
                topic = f"devices/{device_id}/cal/cancel"
                self.client.publish(topic, json.dumps({
                   "topic": topic, 
                   "payload": {
                    **cmd.params,
                    "device_id": device_id
                   }
                }))
            case "pump_control":
                self.device_controller.forward_device_command(cmd.params, "pump_control")
            case "get_offline_sessions":
               user_email = cmd.params.get("userEmail")
               sessions = self.session_controller.get_offline_sessions(user_email)
               
               payload = {
                   "type": "offline_sessions",
                   "payload": sessions,
                   "timestamp": datetime.now(timezone.utc).isoformat()
               }
               self.client.publish("ui/responses/get_offline_sessions", json.dumps(payload))

            case "assign_session_project":
                self.session_controller.assign_session_project(cmd.params)
                self.client.publish("ui/responses/assign_session_project", json.dumps({
                    "status": "success",
                    "sessionId": cmd.params.get("sessionId"),
                    "projectId": cmd.params.get("projectId")
                }))
            case _:
                logger.warning(f"Unhandled UI command: {cmd.command}")

    def handle_device_message(self, topic: str, payload: dict):
        device_id = payload.get("device_id")
        
        # Fallback: Extract device_id from topic (devices/{id}/...)
        if not device_id and topic.startswith("devices/"):
            parts = topic.split("/")
            if len(parts) > 1:
                device_id = parts[1]
                
        if not device_id:
            logger.error(f"Missing device_id in payload or topic: {payload} (Topic: {topic})")
            return
            
        # Ensure payload has device_id for downstream controllers
        if "device_id" not in payload:
            payload["device_id"] = device_id
        
        if topic.endswith("/status"):
            self.device_controller._handle_device_status(device_id, payload)
        elif topic.endswith("/data"):
            self.session_controller._handle_session_data(device_id, payload)
            self.device_controller._handle_device_data(device_id, payload)
        elif topic.endswith("/register"):
            self.device_controller._handle_device_registration(device_id, payload)
        elif topic.endswith("/unregister"):
            self.device_controller._handle_device_disconnect(device_id, payload)
        elif topic.endswith("/prompt_user"):
            self.device_controller._handle_user_prompt( payload, "cal/prompt_user")
        elif topic.endswith("/live_readings"):
            self.device_controller._handle_user_prompt(payload, "cal/live_readings")
        elif topic.endswith("/events"):
            self.device_controller._handle_device_event(device_id, payload)
        elif topic.endswith("/commands/measure"):
            self.spectrometer_controller.handle_measure(device_id, payload)
        elif topic.endswith("/commands/configure"):
            self.spectrometer_controller.handle_configure(device_id, payload)

    def handle_calibration_message(self, topic: str, payload: dict):
        if topic == "magm/calibration/train/request":
            if type(payload) == str:
                try:
                    payload = json.loads(payload)
                except Exception:
                    pass
            from services.chemometrics import run_automl_pipeline
            req_id = payload.get("request_id")
            
            try:
                raw_spectra = payload["raw_spectra"]
                reference_ods = payload["reference_ods"]
                wavelengths = payload["wavelengths"]
                user_config = payload.get("user_config", {})
                
                result = run_automl_pipeline(raw_spectra, reference_ods, wavelengths, user_config)
                
                if result["status"] == "success":
                    winning_model = result["winning_model"]
                    auth0_user_id = payload.get("auth0_user_id", "system")
                    compound_name = payload.get("compound_name", "unknown")
                    
                    if winning_model["algorithm"] == "RandomForest":
                        import joblib
                        import io
                        
                        rf_model = winning_model["rf_model_instance"]
                        buffer = io.BytesIO()
                        joblib.dump(rf_model, buffer)
                        model_blob = buffer.getvalue()
                        
                        model_id = self.db_helper.insert_ml_model(
                            auth0_user_id=auth0_user_id,
                            compound_name=compound_name,
                            algorithm=winning_model["algorithm"],
                            metrics=json.dumps({"r2": winning_model["r2"], "rmse": winning_model["rmse"]}),
                            model_blob=model_blob
                        )
                        
                        # Remove the actual object before sending back JSON
                        del winning_model["rf_model_instance"] 
                    
                    self.client.publish("magm/calibration/train/response", json.dumps({
                        "request_id": req_id,
                        "status": "success",
                        "winning_model": winning_model,
                        "scaler_params": result["scaler_params"],
                        "valid_wavelengths": result["valid_wavelengths"]
                    }))
                    logger.info(f"Calibration model trained successfully. Winner: {winning_model['algorithm']}, R2: {winning_model['r2']}")
            except Exception as e:
                logger.exception("Calibration training error")
                self.client.publish("magm/calibration/train/response", json.dumps({
                    "request_id": req_id,
                    "status": "error",
                    "message": str(e)
                }))

        elif topic == "magm/calibration/capture/request":
            if type(payload) == str:
                try:
                    payload = json.loads(payload)
                except Exception:
                    pass
            req_id = payload.get("request_id")
            latest = self.device_controller.latest_spectrum
            
            if latest:
                spectra = latest["spectra_matrix"]
                raw_spec = spectra[0] if isinstance(spectra, list) and len(spectra)>0 and isinstance(spectra[0], list) else spectra
                self.client.publish("magm/calibration/capture/response", json.dumps({
                    "request_id": req_id,
                    "status": "success",
                    "raw_spectrum": raw_spec,
                    "wavelengths": latest["wavelengths"]
                }))
                logger.info(f"Captured single spectrum for calibration wizard.")
            else:
                self.client.publish("magm/calibration/capture/response", json.dumps({
                    "request_id": req_id,
                    "status": "error",
                    "message": "No spectrum data available yet. Ensure the spectrometer is measuring."
                }))