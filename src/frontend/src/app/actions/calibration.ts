"use server";

import mqtt from 'mqtt';
import { v4 as uuidv4 } from 'uuid';
import { auth0 } from '@/lib/auth0';

// Use the MQTT broker address configured in your environment or default to local edge server
const getBrokerUrl = () => process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

export async function trainCalibrationModel(
  compoundName: string,
  referenceOds: number[],
  spectraMatrix: number[][],
  wavelengths: number[]
) {
  const session = await auth0.getSession();
  const userId = session?.user?.sub || 'anonymous';

  return new Promise((resolve, reject) => {
    const requestId = uuidv4();
    const brokerUrl = getBrokerUrl();
    
    console.log(`[Calibration] Connecting to MQTT broker at ${brokerUrl} for request ${requestId}`);
    const client = mqtt.connect(brokerUrl);

    const timeout = setTimeout(() => {
      client.end();
      reject(new Error("Calibration request timed out. The Edge server might be offline."));
    }, 15000);

    client.on('connect', () => {
      console.log(`[Calibration] Connected. Subscribing to response topic...`);
      client.subscribe('magm/calibration/train/response', (err) => {
        if (!err) {
          const payload = {
            request_id: requestId,
            auth0_user_id: userId,
            compound_name: compoundName,
            reference_ods: referenceOds,
            spectra_matrix: spectraMatrix,
            wavelengths: wavelengths
          };
          client.publish('magm/calibration/train/request', JSON.stringify(payload));
        } else {
          clearTimeout(timeout);
          client.end();
          reject(new Error("Failed to subscribe to MQTT response topic"));
        }
      });
    });

    client.on('message', (topic, message) => {
      if (topic === 'magm/calibration/train/response') {
        try {
          const response = JSON.parse(message.toString());
          if (response.request_id === requestId) {
            clearTimeout(timeout);
            client.end();
            if (response.status === 'success') {
              resolve({ success: true, r2Score: response.r2_score, modelId: response.model_id });
            } else {
              reject(new Error(response.message || 'Calibration failed'));
            }
          }
        } catch (e) {
          console.error("Failed to parse calibration response", e);
        }
      }
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end();
      reject(new Error(`MQTT Connection Error: ${err.message}`));
    });
  });
}

export async function captureSpectrum() {
  return new Promise((resolve, reject) => {
    const requestId = uuidv4();
    const brokerUrl = getBrokerUrl();
    
    const client = mqtt.connect(brokerUrl);

    const timeout = setTimeout(() => {
      client.end();
      reject(new Error("Capture request timed out."));
    }, 15000);

    client.on('connect', () => {
      client.subscribe('magm/calibration/capture/response', (err) => {
        if (!err) {
          const payload = { request_id: requestId };
          client.publish('magm/calibration/capture/request', JSON.stringify(payload));
        } else {
          clearTimeout(timeout);
          client.end();
          reject(new Error("Failed to subscribe to capture response topic"));
        }
      });
    });

    client.on('message', (topic, message) => {
      if (topic === 'magm/calibration/capture/response') {
        try {
          const response = JSON.parse(message.toString());
          if (response.request_id === requestId) {
            clearTimeout(timeout);
            client.end();
            if (response.status === 'success') {
              resolve({ success: true, spectrum: response.spectrum, wavelengths: response.wavelengths });
            } else {
              reject(new Error(response.message || 'Capture failed'));
            }
          }
        } catch (e) {
          console.error("Failed to parse capture response", e);
        }
      }
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end();
      reject(new Error(`MQTT Connection Error: ${err.message}`));
    });
  });
}
