import os
import joblib 
import numpy as np
from typing import Dict, List, Any, Optional
from scipy.signal import savgol_filter
from shared.utils.logger import logger
from sklearn.base import BaseEstimator

class MLService:
 
    OD_WAVELENGTHS = [1016, 1080, 1105] 
    CO2_WAVELENGTHS = [1016, 1080, 1105]

    def __init__(self, models_dir: str = "src/edge_server/ml_models"):
        self.models_dir = os.path.abspath(models_dir)
        self.od_model = None
        self.co2_model = None
        self.load_models()
        logger.debug("MLService initialized")

    def load_models(self):
        """Loads OD and CO2 models using joblib."""
        try:
            od_path = os.path.join(self.models_dir, "od_model.pkl")
            co2_path = os.path.join(self.models_dir, "co2_model.pkl")

            if os.path.exists(od_path):
                self.od_model = joblib.load(od_path)
                logger.info(f"Loaded OD model from {od_path}")
            else:
                logger.warning(f"OD model not found at {od_path}")

            if os.path.exists(co2_path):
                self.co2_model = joblib.load(co2_path)
                logger.info(f"Loaded CO2 model from {co2_path}")
            else:
                logger.warning(f"CO2 model not found at {co2_path}")

        except Exception as e:
            logger.error(f"Error loading ML models: {e}")

    def predict(self, payload: Dict[str, Any]) -> Dict[str, Optional[float]]:
        # ... (docstring) ...
        results = {"od": None, "dissolved_co2": None}
        
        try:
            logger.debug("MLService: Starting prediction...")
            spectra = payload.get("spectra")
            wavelengths = payload.get("wavelengths")

            if not spectra or not wavelengths:
                logger.warning(f"ML Prediction skipped: Missing data. Spectra={bool(spectra)}, WL={bool(wavelengths)}")
                return results

            # Convert to numpy arrays
            spectra_arr = np.array(spectra)
            wavelengths_arr = np.array(wavelengths)
            
            logger.debug(f"Input shapes: Spectra={spectra_arr.shape}, WL={wavelengths_arr.shape}")

            # --- OD Prediction ---
            if self.od_model and self.OD_WAVELENGTHS:
                processed_od = self._preprocess(spectra_arr, wavelengths_arr, self.OD_WAVELENGTHS)
                if processed_od is not None:
                     pred = self.od_model.predict(processed_od.reshape(1, -1))[0]
                     results["od"] = float(pred)
                     logger.debug(f"OD Predicted: {pred}")
                else:
                    logger.warning("OD Preprocessing returned None")
            else:
                logger.warning(f"OD Model not loaded or WL missing. Model={bool(self.od_model)}")

            # --- CO2 Prediction ---
            if self.co2_model and self.CO2_WAVELENGTHS:
                processed_co2 = self._preprocess(spectra_arr, wavelengths_arr, self.CO2_WAVELENGTHS)
                if processed_co2 is not None:
                    pred = self.co2_model.predict(processed_co2.reshape(1, -1))[0]
                    results["dissolved_co2"] = float(pred)
                    logger.debug(f"CO2 Predicted: {pred}")
            
            logger.debug(f"ML Prediction results: {results}")
            return results

        except Exception as e:
            logger.error(f"Error during ML prediction: {e}")
            return results

    def _preprocess(self, spectra: np.ndarray, current_wavelengths: np.ndarray, target_wavelengths: List[float]) -> Optional[np.ndarray]:
        # ... (docstring) ...
        try:
            # 1. Savitzky-Golay Filter
            sg_spectra = savgol_filter(spectra, window_length=18, polyorder=2)
            
            # 2. SNV Transformation
            snv_spectra = self._apply_snv(sg_spectra)

            # 3. Selection: Find nearest wavelength indices
            selected_intensities = []
            for target in target_wavelengths:
                # Find index of wavelength closest to target
                idx = (np.abs(current_wavelengths - target)).argmin()
                selected_intensities.append(snv_spectra[idx])
            
            final_spectra = np.array(selected_intensities)
            return final_spectra

        except Exception as e:
            logger.error(f"Error in preprocessing: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None

    def _apply_snv(self, data: np.ndarray) -> np.ndarray:
        """Applies Standard Normal Variate (SNV) transformation."""
        # SNV = (x - mean) / std_dev
        return (data - np.mean(data)) / np.std(data)
