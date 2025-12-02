"use client";

import { useEffect, useState, useCallback } from "react";
import Calibration from "./calibration";
import { useMQTT } from "@/contexts/MQTTContext";
import { TCalibrationStatus, TAlert } from "@/types";

const DEVICE_ID = "d09454f7-6a4a-44af-9e0d-eb0bea17e9de";


const COMMAND_TOPIC = "ui/commands";
const DATA_TOPIC = "data_aquisition/sensor_data/rpi_data";
const CAL_PROMPT_TOPIC = `/devices/${DEVICE_ID}/cal/prompt_user`;
const CAL_LIVE_TOPIC = `/devices/${DEVICE_ID}/cal/live_readings`;
const SYSTEM_NOTIF_TOPIC = "system/notifications";
const ALERT_TOPIC = "ui/alerts";
const CAL_TOPICS = [
  CAL_PROMPT_TOPIC,
  CAL_LIVE_TOPIC,
  DATA_TOPIC,
  SYSTEM_NOTIF_TOPIC,
  ALERT_TOPIC
];

export default function Page() {
  const { isConnected, connection, publish } = useMQTT();

  const [messages, setMessages] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);

  const [isRPIConnected, setIsRPIConnected] = useState(false);
  const [calibrationStatus, setCalibrationStatus] = useState<TCalibrationStatus>("READY");
  const [calibrationData, setCalibrationData] = useState<any | null>(null);
  const [liveReading, setLiveReading] = useState<{ ph?: number, stability?: number } | null>(null);
  const [wizardStep, setWizardStep] = useState<string>("IDLE");
  const [onlineDevices, setOnlineDevices] = useState<Record<string, boolean>>({});
  const [alerts, setAlerts] = useState<TAlert[]>([]);


  useEffect(() => {

    if (isConnected && connection) {
      sendCommand("ping_device", { device_id: DEVICE_ID });
    }
  }, [isConnected, connection]);


  // 5️⃣ Send command to device
  const sendCommand = useCallback((command: string, params: Record<string, any> = {}) => {
    if (!connection || !isConnected) {
      console.warn("Cannot send command, not connected");
      return;
    }
    const topic = `${COMMAND_TOPIC}/${command}`;
    const payload = {
      command,
      params,
    };

    const json_payload = JSON.stringify(payload);
    publish(topic, json_payload);
    console.log("📤 Sent command to:", topic);
  }, [connection, isConnected])




  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-2">AWS IoT Live Data & Control Panel</h1>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <span
            className={`h-3 w-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"
              }`}
          ></span>
          <span>{isConnected ? " AWS Connected" : "AWS Disconnected"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-3 w-3 rounded-full ${isRPIConnected ? "bg-green-500" : "bg-red-500"
              }`}
          ></span>
          <span>{isRPIConnected ? " RPI Connected" : "RPI Disconnected"}</span>
        </div>
      </div>

      {/* Command Buttons */}
      <div className="flex gap-4 mt-4">
        <button
          onClick={() => sendCommand("start_session", {
            user: "auth|09875407429'20842",
            project_id: "WNDRIKGnwkerfnwe32324",
            notes: "This is a note"
          })}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          ▶ Start Measurement
        </button>
        <button
          onClick={() => sendCommand("stop_session")}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          ⏹ Shutdown
        </button>
        <Calibration
          connection={connection}
          calibrationStatus={calibrationStatus}
          calibrationData={calibrationData}
          liveReading={liveReading}
          setCalibrationStatus={setCalibrationStatus}
        />
      </div>
      <section className="mt-4">
        <h2 className="font-semibold text-lg">Connected Devices</h2>
        <ul className="space-y-1 mt-2">
          {Object.entries(onlineDevices).map(([id, online]) => (
            <li key={id} className="text-sm flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${online ? "bg-green-500" : "bg-red-500"}`}></span>
              <span>{id}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Active Alerts */}
      <section>
        <h2 className="text-xl font-semibold mt-6 mb-2 text-red-600">⚠️ Active Alerts</h2>
        {alerts.length === 0 ? (
          <p className="text-gray-500 italic">No active alerts.</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert, i) => (
              <li key={i} className="border border-red-200 p-3 rounded bg-red-50 flex flex-col gap-1">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-red-700">{alert.details.sensor_type} Anomaly</span>
                  <span className="text-xs text-gray-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm text-gray-800">{alert.message}</p>
                <div className="text-xs text-gray-600">
                  Value: <span className="font-mono">{alert.details.value}</span> | Device: <span className="font-mono">{alert.details.device_id}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {/* Live Sensor Data */}
      <section>
        <h2 className="text-xl font-semibold mt-6 mb-2">📡 Incoming Sensor Data</h2>
        <ul className="space-y-2">
          {messages.map((m, i) => (
            <li key={i} className="border p-2 rounded bg-gray-50">
              <pre className="text-sm">{JSON.stringify(m, null, 2)}</pre>
            </li>
          ))}
        </ul>
      </section>

      {/* Device Responses */}
      <section>
        <h2 className="text-xl font-semibold mt-6 mb-2">🪄 Device Responses</h2>
        <ul className="space-y-2">
          {responses.map((r, i) => (
            <li key={i} className="border p-2 rounded bg-green-50">
              <pre className="text-sm">{JSON.stringify(r, null, 2)}</pre>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}