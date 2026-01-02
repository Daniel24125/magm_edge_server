import React from 'react'
import { TCalibrationStatus } from "@/types";
import { MqttClient } from 'mqtt'; // Assuming mqtt is installed

type Props = {
    connection: MqttClient | null;
    calibrationStatus: TCalibrationStatus;
    calibrationData?: any;
    liveReading?: { ph?: number; stability?: number } | null;
    setCalibrationStatus: React.Dispatch<React.SetStateAction<TCalibrationStatus>>;
}
const DEVICE_ID = "d09454f7-6a4a-44af-9e0d-eb0bea17e9de";
const SENSOR_ID = "e6cc7497-d0aa-4cd9-9e56-578b6f9db521";

const Calibration = ({
    connection,
    calibrationStatus,
    calibrationData,
    liveReading,
    setCalibrationStatus
}: Props) => {
    const publishCommand = (command: string, params: Record<string, any> = {}) => {
        if (!connection) {
            alert("Not connected to Broker yet");
            return;
        }
        const topic = `ui/commands/${command}`;
        const payload = JSON.stringify({
            command,
            params: { device_id: DEVICE_ID, sensor_id: SENSOR_ID, ...params },
        });

        // MQTT.js publish signature: publish(topic, message, [opts], [callback])
        connection.publish(topic, payload, { qos: 1 });
        console.log("📤 Sent command:", command, payload);
    };

    const start = () => publishCommand("start_calibration");
    const confirm = () => publishCommand("confirm_calibration");
    const cancel = () => publishCommand("cancel_calibration");





    return (
        <div className="p-4 border rounded bg-gray-50 w-full max-w-md">
            <h3 className="font-bold text-lg mb-2">pH Calibration</h3>

            {calibrationStatus === "READY" && (
                <button
                    onClick={start}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Start Calibration
                </button>
            )}

            {calibrationStatus !== "READY" && (
                <div className="space-y-3">
                    <p className="text-sm">
                        <b>Status:</b> {calibrationStatus}
                    </p>
                    {liveReading && (
                        <div className="text-sm">
                            <p>
                                pH:{" "}
                                <span className="font-semibold">
                                    {liveReading.ph?.toFixed(2)}
                                </span>
                            </p>
                            <p>
                                Stability:{" "}
                                <span className="font-semibold">
                                    {(liveReading.stability ?? 0) * 100}%
                                </span>
                            </p>
                        </div>
                    )}
                    {calibrationData?.calibration_data && (
                        <pre className="bg-gray-100 p-2 rounded text-xs">
                            {JSON.stringify(calibrationData.calibration_data, null, 2)}
                        </pre>
                    )}

                    {calibrationStatus === "COMPLETED" && (
                        <div className="flex gap-2">
                            <button
                                onClick={confirm}
                                className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                                ✅ Confirm Calibration
                            </button>
                            <button
                                onClick={cancel}
                                className="flex-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                ❌ Cancel
                            </button>
                        </div>
                    )}

                    {calibrationStatus !== "COMPLETED" && (
                        <button
                            onClick={cancel}
                            className="w-full px-3 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default Calibration
