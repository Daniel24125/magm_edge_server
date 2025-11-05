import { mqtt } from 'aws-iot-device-sdk-v2';
import React from 'react'

export type TCalibtationStatus = "READY" | "ACIDIC" | "ALKALINE" | "FAILED";

type TCalibrationButtonProps = {
    connection: mqtt.MqttClientConnection | null;
    calibrationStatus: TCalibtationStatus;
    setCalibrationStatus: React.Dispatch<React.SetStateAction<TCalibtationStatus>>;
    // calibrationData: any;
}

const Calibration = ({connection, calibrationStatus, setCalibrationStatus}: TCalibrationButtonProps) => {

    const sendCalibationFeedback = (params: any )=>{
        if (!connection) {
            alert("Not connected to AWS IoT yet");
            return;
            }
            const topic = `ui/commands/start_calibration`;

            const json_payload = JSON.stringify(params);
            connection.publish(topic, json_payload, mqtt.QoS.AtLeastOnce);
            console.log("📤 Sent calibration command to:", topic);
    }

    

    return <>
         <button
            disabled={calibrationStatus !== "READY"}
            onClick={() => sendCalibationFeedback({
                command: "start_calibration",
                params:{
                    device_id: "d09454f7-6a4a-44af-9e0d-eb0bea17e9de",
                    user: "auth|09875407429'20842",
                    user_name: "Daniel Madalena",
                    sensor_id: "e6cc7497-d0aa-4cd9-9e56-578b6f9db521"
                }

            })}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
            Start Calibraiton
        </button>
        {calibrationStatus !== "READY" && <button
            // disabled={calibrationData!.is_stable === false}
            // onClick={() => sendCalibationFeedback("start_calibration", {
            //     device_id: "d09454f7-6a4a-44af-9e0d-eb0bea17e9de",
            //     user: "auth|09875407429'20842",
            //     user_name: "Daniel Madalena",
            //     sensor_id: "e6cc7497-d0aa-4cd9-9e56-578b6f9db521"
            // })}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
            {calibrationStatus === "ACIDIC" ? "Next Standard" : 
             calibrationStatus === "ALKALINE" ? "Finish Calibration" :
             calibrationStatus === "FAILED" ? "Retry Calibration" :
             "Calibrating..."}
        </button>}
    </>
}

export default Calibration
