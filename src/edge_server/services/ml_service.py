import io
import os
import joblib 
import numpy as np
from typing import Dict, List, Any, Optional
from scipy.signal import savgol_filter
from shared.utils.logger import logger

class MLService:
 
    OD_WAVELENGTHS = [1016, 1080, 1105] 
    CO2_WAVELENGTHS = [1016, 1080, 1105]

    def __init__(self, db_helper=None):
        self.db_helper = db_helper
        self.model_cache = {} # Structure: {"od": {"id": 1, "model": obj}, "co2": {...}}
        logger.debug("MLService initialized with database dependency")

    def _get_model(self, user_id: str, compound: str) -> Optional[Any]:
        """
        Retrieves the active model for a specific compound from the DB,
        using an in-memory cache to avoid redundant deserialization.
        """
        if not self.db_helper:
            logger.warning("MLService: No db_helper provided, cannot fetch models.")
            return None

        try:
            # 1. Check DB for active model ID and BLOB
            db_record = self.db_helper.get_active_ml_model(user_id, compound)
            
            if not db_record:
                # If no model in DB, clear cache for this compound and return None
                if compound in self.model_cache:
                    logger.info(f"MLService: Active {compound} model removed from DB. Clearing cache.")
                    del self.model_cache[compound]
                return None

            model_id = db_record["id"]
            
            # 2. Check cache
            cached = self.model_cache.get(compound)
            if cached and cached.get("id") == model_id:
                return cached["model"]

            # 3. Cache miss or new version: Load and store
            logger.info(f"MLService: Loading/Updating {compound} model (ID: {model_id}) from database...")
            model = joblib.load(io.BytesIO(db_record["blob"]))
            self.model_cache[compound] = {
                "id": model_id,
                "model": model
            }
            return model

        except Exception as e:
            logger.error(f"MLService: Error during {compound} model retrieval: {e}")
            return None

    def predict(self, payload: Dict[str, Any], user_id: str = "system") -> Dict[str, Optional[float]]:
        """
        Runs ML predictions for OD and CO2 using models fetched from the database.
        """
        results = {"od": None, "dissolved_co2": None}
        
        try:
            spectra = payload.get("spectra")
            wavelengths = payload.get("wavelengths")

            if not spectra or not wavelengths:
                return results

            # Convert to numpy arrays
            spectra_arr = np.array(spectra)
            wavelengths_arr = np.array(wavelengths)
            
            # --- OD Prediction ---
            od_model = self._get_model(user_id, "od")
            if od_model:
                processed_od = self._preprocess(spectra_arr, wavelengths_arr, self.OD_WAVELENGTHS)
                if processed_od is not None:
                     pred = od_model.predict(processed_od.reshape(1, -1))[0]
                     results["od"] = float(pred)
                     logger.debug(f"OD Predicted ({user_id}): {pred}")

            # --- CO2 Prediction ---
            co2_model = self._get_model(user_id, "co2")
            if co2_model:
                processed_co2 = self._preprocess(spectra_arr, wavelengths_arr, self.CO2_WAVELENGTHS)
                if processed_co2 is not None:
                    pred = co2_model.predict(processed_co2.reshape(1, -1))[0]
                    results["dissolved_co2"] = float(pred)
                    logger.debug(f"CO2 Predicted ({user_id}): {pred}")
            
            return results

        except Exception as e:
            logger.error(f"Error during ML prediction: {e}")
            return results

    def _preprocess(self, spectra: np.ndarray, current_wavelengths: np.ndarray, target_wavelengths: List[float]) -> Optional[np.ndarray]:
        try:
            # 1. Savitzky-Golay Filter
            sg_spectra = savgol_filter(spectra, window_length=18, polyorder=2)
            
            # 2. SNV Transformation
            snv_spectra = self._apply_snv(sg_spectra)

            # 3. Selection: Find nearest wavelength indices
            selected_intensities = []
            for target in target_wavelengths:
                idx = (np.abs(current_wavelengths - target)).argmin()
                selected_intensities.append(snv_spectra[idx])
            
            return np.array(selected_intensities)

        except Exception as e:
            logger.error(f"Error in preprocessing: {e}")
            return None

    def _apply_snv(self, data: np.ndarray) -> np.ndarray:
        """Applies Standard Normal Variate (SNV) transformation."""
        return (data - np.mean(data)) / np.std(data)
