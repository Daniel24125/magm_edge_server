"use client";

import { useEffect, useState } from "react";
import { mqtt, iot } from "aws-iot-device-sdk-v2";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";

const AWS_REGION = "eu-west-3";
const IDENTITY_POOL_ID = "eu-west-3:390b2bb4-3f18-4d96-a51e-0943eeda80fd";
const IOT_ENDPOINT = "a11r358gjcsqpj-ats.iot.eu-west-3.amazonaws.com"; 
const TOPIC = "data_aquisition/sensor_data/rpi_data";

export default function Page() {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    async function connectAndSubscribe() {
      try {
        // 1️⃣ Get credentials from Cognito Identity Pool
        const provider = fromCognitoIdentityPool({
          clientConfig: { region: AWS_REGION },
          identityPoolId: IDENTITY_POOL_ID,
        });

        const credentials = await provider();
        console.log("Cognito creds:", credentials);

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
        connection.on("connect", () => console.log("✅ Connected to AWS IoT Core"));
        connection.on("message", (topic, payload) => {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          setMessages((prev) => [msg, ...prev]);
        });

        // 4️⃣ Connect & subscribe
        await connection.connect().catch((err) => {
          console.error("❌ Connection failed:", err);
        });
        await connection.subscribe(TOPIC, mqtt.QoS.AtLeastOnce);
      } catch (err) {
        console.error("❌ Connection error:", err);
      }
    }

    connectAndSubscribe();
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">AWS IoT Live Data</h1>
      <ul className="space-y-2">
        {messages.map((m, i) => (
          <li key={i} className="border p-2 rounded bg-gray-50">
            <pre>{JSON.stringify(m, null, 2)}</pre>
          </li>
        ))}
      </ul>
    </main>
  );
}