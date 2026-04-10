import numpy as np
from sklearn.cross_decomposition import PLSRegression

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
    
    coeffs_array = np.array(coefficients)
    x_mean_array = np.array(x_mean)
    
    # Defensive check: Ensure shapes match for matrix operations
    if X_live_cropped.shape[0] != coeffs_array.shape[0]:
        return None
        
    centered_spectrum = X_live_cropped - x_mean_array
    predicted_od = np.dot(centered_spectrum, coeffs_array) + y_mean
    
    return max(0.0, float(predicted_od))
