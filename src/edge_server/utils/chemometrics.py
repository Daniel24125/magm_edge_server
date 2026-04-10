import numpy as np
from sklearn.cross_decomposition import PLSRegression
from scipy.interpolate import interp1d

def crop_water_band(spectra_matrix, wavelengths):
    spectra_array = np.array(spectra_matrix)
    wavelengths_array = np.array(wavelengths)
    valid_mask = (wavelengths_array < 1400) | (wavelengths_array > 1550)
    # If spectra_matrix is 1D (a single spectrum), handle it safely
    if spectra_array.ndim == 1:
        return spectra_array[valid_mask]
    return spectra_array[:, valid_mask]

def train_pls_model(raw_spectra_matrix, reference_ods, wavelengths):
    X_cropped = crop_water_band(raw_spectra_matrix, wavelengths)
    Y = np.array(reference_ods)
    
    # scale=False forces scikit-learn to mean-center internally without destroying scattering magnitude
    pls = PLSRegression(n_components=3, scale=False)
    pls.fit(X_cropped, Y)
    
    r2_score = pls.score(X_cropped, Y)
    
    return {
        "coefficients": pls.coef_.flatten().tolist(),
        "x_mean": pls._x_mean.tolist(),
        "y_mean": float(pls._y_mean[0]),
        "r2_score": float(r2_score)
    }

def predict_od(raw_spectrum, wavelengths, coefficients, x_mean, y_mean):
    spectrum_array = np.array(raw_spectrum)
    X_live_cropped = crop_water_band(spectrum_array, wavelengths)
    
    coeffs = np.array(coefficients)
    x_m = np.array(x_mean)

    # 1. Dynamically resample live spectrum to match the model's coefficients
    if len(X_live_cropped) > 1 and len(X_live_cropped) != len(coeffs):
        x_old = np.linspace(0, 1, len(X_live_cropped))
        x_new = np.linspace(0, 1, len(coeffs))
        f = interp1d(x_old, X_live_cropped, kind='linear')
        X_live_cropped = f(x_new)

    # 2. Dynamically resample x_mean to match the new spectrum length
    if len(x_m) > 1 and len(x_m) != len(X_live_cropped):
        x_old_m = np.linspace(0, 1, len(x_m))
        x_new_m = np.linspace(0, 1, len(X_live_cropped))
        f_m = interp1d(x_old_m, x_m, kind='linear')
        x_m = f_m(x_new_m)

    # 3. Mean centering and Prediction
    if len(x_m) > 0:
        centered_spectrum = X_live_cropped - x_m
    else:
        centered_spectrum = X_live_cropped
        
    predicted_od = np.dot(centered_spectrum, coeffs) + y_mean
    
    return max(0.0, float(predicted_od))
