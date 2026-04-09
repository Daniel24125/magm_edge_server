import numpy as np
import joblib
import io
from scipy.signal import savgol_filter
from sklearn.cross_decomposition import PLSRegression
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_squared_error
from sklearn.preprocessing import StandardScaler

def apply_preprocessing(spectra, wavelengths, target_type, sg_window, sg_poly, sg_deriv):
    """Applies cropping, Savitzky-Golay, and conditional SNV."""
    # 1. Crop water band (1400-1550 nm)
    valid_mask = (wavelengths < 1400) | (wavelengths > 1550)
    cropped_spectra = spectra[:, valid_mask]
    cropped_waves = wavelengths[valid_mask]
    
    # 2. Savitzky-Golay Smoothing
    smoothed = savgol_filter(cropped_spectra, window_length=sg_window, polyorder=sg_poly, deriv=sg_deriv, axis=1)
    
    # 3. Target Type Logic (The SNV Trap)
    scaler_params = {}
    if target_type == "chemical_compound":
        # Apply SNV (Standard Normal Variate) - row-wise standardization
        mean_spectra = np.mean(smoothed, axis=1, keepdims=True)
        std_spectra = np.std(smoothed, axis=1, keepdims=True)
        processed_spectra = (smoothed - mean_spectra) / std_spectra
        scaler_params['method'] = 'snv'
    else:
        # Biomass/Turbidity - strictly preserve scattering magnitude, apply column-wise Mean Centering only
        scaler = StandardScaler(with_std=False)
        processed_spectra = scaler.fit_transform(smoothed)
        scaler_params['method'] = 'mean_center'
        scaler_params['x_mean'] = scaler.mean_.tolist()
        
    return processed_spectra, cropped_waves, scaler_params

def calculate_vips(pls_model):
    """Calculates Variable Importance in Projection (VIP) scores for PLS."""
    t = pls_model.x_scores_
    w = pls_model.x_weights_
    q = pls_model.y_loadings_
    p, h = w.shape
    vips = np.zeros((p,))
    s = np.diag(t.T @ t @ q.T @ q).reshape(h, -1)
    total_s = np.sum(s)
    for i in range(p):
        weight = np.array([ (w[i,j] / np.linalg.norm(w[:,j]))**2 for j in range(h) ])
        vips[i] = np.sqrt(p * (s.T @ weight)/total_s)
    return vips

def filter_peaks_for_mlr(vips, wavelengths, min_distance_nm=15, top_n=5):
    """Prevents collinearity in MLR by ensuring selected VIP peaks are spaced apart."""
    sorted_indices = np.argsort(vips)[::-1]
    selected_indices = []
    
    for idx in sorted_indices:
        if len(selected_indices) >= top_n:
            break
        wave = wavelengths[idx]
        # Check distance against already selected peaks
        if all(abs(wave - wavelengths[s_idx]) >= min_distance_nm for s_idx in selected_indices):
            selected_indices.append(idx)
            
    return selected_indices

def run_automl_pipeline(raw_spectra, reference_ods, wavelengths, user_config):
    """Evaluates PLSR, MLR, and RF, returning the winning model."""
    if len(raw_spectra) < 2:
        return {
            "status": "error",
            "message": "AutoML training requires at least 2 samples. Please capture more data."
        }

    X, valid_waves, scaler_params = apply_preprocessing(
        np.array(raw_spectra), 
        np.array(wavelengths), 
        user_config.get('target_type', 'chemical_compound'), 
        user_config.get('sg_window', 11), 
        user_config.get('sg_poly', 2), 
        user_config.get('sg_deriv', 0)
    )
    Y = np.array(reference_ods)
    
    models_results = []
    
    # --- MODEL A: PLSR (Baseline) ---
    pls = PLSRegression(n_components=3, scale=False)
    pls.fit(X, Y)
    Y_pred_pls = pls.predict(X)
    vips = calculate_vips(pls)
    models_results.append({
        "algorithm": "PLSR",
        "r2": float(r2_score(Y, Y_pred_pls)),
        "rmse": float(np.sqrt(mean_squared_error(Y, Y_pred_pls))),
        "coefficients": pls.coef_.flatten().tolist(),
        "y_mean": float(pls._y_mean[0]),
        "selected_wavelengths_indices": list(range(len(valid_waves))) # Uses all valid
    })
    
    # --- Feature Selection for MLR & RF ---
    mlr_indices = filter_peaks_for_mlr(vips, valid_waves, min_distance_nm=15, top_n=5)
    X_reduced = X[:, mlr_indices]
    
    # --- MODEL B: Multiple Linear Regression ---
    mlr = LinearRegression()
    mlr.fit(X_reduced, Y)
    Y_pred_mlr = mlr.predict(X_reduced)
    models_results.append({
        "algorithm": "MLR",
        "r2": float(r2_score(Y, Y_pred_mlr)),
        "rmse": float(np.sqrt(mean_squared_error(Y, Y_pred_mlr))),
        "coefficients": mlr.coef_.flatten().tolist(),
        "intercept": float(mlr.intercept_),
        "selected_wavelengths_indices": mlr_indices
    })
    
    # --- MODEL C: Random Forest Regressor ---
    rf = RandomForestRegressor(n_estimators=100, random_state=42)
    rf.fit(X_reduced, Y)
    Y_pred_rf = rf.predict(X_reduced)
    # Note: RF doesn't store simple coefficients, we must serialize the model object using joblib or similar if RF wins.
    # For this iteration, we track its performance. If RF wins, we flag it for binary serialization in the DB.
    models_results.append({
        "algorithm": "RandomForest",
        "r2": float(r2_score(Y, Y_pred_rf)),
        "rmse": float(np.sqrt(mean_squared_error(Y, Y_pred_rf))),
        "selected_wavelengths_indices": mlr_indices,
        "rf_model_instance": rf # Agent note: implement joblib.dump to byte array for DB storage if this wins
    })
    
    # Select the model with the highest R2
    winning_model = max(models_results, key=lambda x: x['r2'])
    
    return {
        "status": "success",
        "winning_model": winning_model,
        "scaler_params": scaler_params,
        "valid_wavelengths": valid_waves.tolist()
    }
