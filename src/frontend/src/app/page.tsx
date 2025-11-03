"use client";

import { useEffect, useState } from "react";
import { mqtt, iot } from "aws-iot-device-sdk-v2";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";

const AWS_REGION = "eu-west-3";
const IDENTITY_POOL_ID = "eu-west-3:390b2bb4-3f18-4d96-a51e-0943eeda80fd";
const IOT_ENDPOINT = "a11r358gjcsqpj-ats.iot.eu-west-3.amazonaws.com"; 
const COMMAND_TOPIC = "ui/commands";
const DATA_TOPIC = "data_aquisition/sensor_data/rpi_data";

export default function Page() {
  const [messages, setMessages] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [connection, setConnection] = useState<mqtt.MqttClientConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  
  useEffect(() => {
    async function connectAndSubscribe() {
      try {
        // 1️⃣ Get credentials from Cognito Identity Pool
        const provider = fromCognitoIdentityPool({
          clientConfig: { region: AWS_REGION },
          identityPoolId: IDENTITY_POOL_ID,
        });

        const credentials = await provider();
        console.log("Cognito credentials obtained");


        // 2️⃣ Build AWS IoT MQTT connection over WebSocket
        const client = new mqtt.MqttClient();

        const configBuilder =
          iot.AwsIotMqttConnectionConfigBuilder.new_with_websockets()
            .with_clean_session(true)
            .with_client_id("webclient-" + Math.floor(Math.random() * 10000))
            .with_endpoint(IOT_ENDPOINT)
            .with_credentials(
              AWS_REGION,
              credentials.accessKeyId,
              credentials.secretAccessKey,
              credentials.sessionToken
            )
            .with_keep_alive_seconds(60);

        const connection = client.new_connection(configBuilder.build());

        // 3️⃣ Handle events
        connection.on("connect", () => {
          console.log("✅ Connected to AWS IoT Core")
          setIsConnected(true)
        });
        connection.on("disconnect", () => {
          console.log("⚠️ Disconnected from AWS IoT Core");
          setIsConnected(false);
        });

        connection.on("message", (topic, payload) => {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          if (topic === DATA_TOPIC) setMessages((prev) => [msg, ...prev]);
        });

        // 4️⃣ Connect & subscribe
        await connection.connect();
        await connection.subscribe(DATA_TOPIC, mqtt.QoS.AtLeastOnce);
        setConnection(connection);

      } catch (err) {
        console.error("❌ Connection error:", err);
      }
    }

    connectAndSubscribe();

    return () => {
      // Graceful disconnect on unmount
      if (connection) {
        connection.disconnect();
        console.log("🔌 Disconnected cleanly");
      }
    };
  }, []);


  // 5️⃣ Send command to device
  const sendCommand = (command: string, params: Record<string, any> = {}) => {
    if (!connection || !isConnected) {
      alert("Not connected to AWS IoT yet");
      return;
    }
    const topic = `${COMMAND_TOPIC}/${command}`;
    const payload = {
      command,
      params,
    };

    const json_payload = JSON.stringify(payload);
    connection.publish(topic, json_payload, mqtt.QoS.AtLeastOnce);
    console.log("📤 Sent command to:", topic);
  };

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-2">AWS IoT Live Data & Control Panel</h1>

      <div className="flex items-center gap-2">
        <span
          className={`h-3 w-3 rounded-full ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
        ></span>
        <span>{isConnected ? "Connected" : "Disconnected"}</span>
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
        <button
          onClick={() => sendCommand("start_calibration", {
            device_id: "e6cc7497-d0aa-4cd9-9e56-578b6f9db521",
            user: "auth|09875407429'20842",
            user_name: "Daniel Madalena",
            sensor_id: "e6cc7497-d0aa-4cd9-9e56-578b6f9db521"

          })}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Start Calibraiton
        </button>
      </div>

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