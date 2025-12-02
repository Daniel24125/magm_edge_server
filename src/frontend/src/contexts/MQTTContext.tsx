/**
 * MQTTContext.tsx
 *
 * Responsibilities:
 * - Exposes a global MQTT state (e.g., MQTT connection, messages, responses, subscriptions).
 * 
 * Usage:
 * Wrap the root layout with <MQTTProvider> and use useMQTT()
 * in child components to access or update global state.
 */
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { mqtt, iot } from "aws-iot-device-sdk-v2";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { useAlert } from "./AlertContext";

// --- Configuration Constants ---
// TODO: Move these to a config file or environment variables
const AWS_REGION = "eu-west-3";
const IDENTITY_POOL_ID = "eu-west-3:390b2bb4-3f18-4d96-a51e-0943eeda80fd";
const IOT_ENDPOINT = "a11r358gjcsqpj-ats.iot.eu-west-3.amazonaws.com";

type TMessageHandler = (topic: string, payload: any) => void;

interface MQTTContextType {
    connection: mqtt.MqttClientConnection | null;
    isConnected: boolean;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    subscribe: (topic: string, handler?: TMessageHandler) => Promise<void>;
    unsubscribe: (topic: string, handler?: TMessageHandler) => Promise<void>;
    publish: (topic: string, payload: any) => Promise<void>;
}

const MQTTContext = createContext<MQTTContextType | null>(null);

export const MQTTProvider = ({ children }: { children: React.ReactNode }) => {
    const { addAlert } = useAlert();
    const [connection, setConnection] = useState<mqtt.MqttClientConnection | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const messageHandlers = useRef<Map<string, Set<TMessageHandler>>>(new Map());

    // 1. Connection Logic
    const connect = useCallback(async () => {
        if (isConnected) return;

        try {
            const provider = fromCognitoIdentityPool({
                clientConfig: { region: AWS_REGION },
                identityPoolId: IDENTITY_POOL_ID,
            });
            const credentials = await provider();

            const client = new mqtt.MqttClient();
            const configBuilder = iot.AwsIotMqttConnectionConfigBuilder.new_with_websockets()
                .with_clean_session(true)
                .with_client_id("webclient-" + Math.floor(Math.random() * 100000))
                .with_endpoint(IOT_ENDPOINT)
                .with_credentials(
                    AWS_REGION,
                    credentials.accessKeyId,
                    credentials.secretAccessKey,
                    credentials.sessionToken
                )
                .with_keep_alive_seconds(60);

            const newConnection = client.new_connection(configBuilder.build());

            // Event Listeners
            newConnection.on("connect", (sessionPresent) => {
                console.log("✅ Connected to AWS IoT Core");
                setIsConnected(true);
            });

            newConnection.on("disconnect", () => {
                addAlert("warning", "Disconnected from AWS IoT Core");
                setIsConnected(false);
            });

            newConnection.on("message", (topic, payload) => {
                const payloadStr = new TextDecoder().decode(payload);
                try {
                    const parsed = JSON.parse(payloadStr);
                    // Dispatch to handlers
                    const handlers = messageHandlers.current.get(topic);
                    if (handlers) {
                        handlers.forEach(h => h(topic, parsed));
                    }
                    // TODO: dispatch to wildcard handlers if we had them, but for now exact match
                } catch (e) {
                    addAlert("error", "Failed to parse MQTT message", e);
                }
            });

            await newConnection.connect();
            setConnection(newConnection);

        } catch (error) {
            console.error("❌ MQTT Connection Failed:", error);
        }
    }, [isConnected]);

    const disconnect = useCallback(async () => {
        if (connection) {
            await connection.disconnect();
            setConnection(null);
            setIsConnected(false);
        }
    }, [connection]);

    // 2. Subscribe Logic
    const subscribe = useCallback(async (topic: string, handler?: TMessageHandler) => {
        if (!connection) {
            addAlert("warning", "No MQTT connection");
            return;
        }

        // Register handler
        if (handler) {
            if (!messageHandlers.current.has(topic)) {
                messageHandlers.current.set(topic, new Set());
            }
            messageHandlers.current.get(topic)?.add(handler);
        }

        // Perform MQTT subscription (idempotent-ish)
        // We always subscribe at least once. 
        // Optimization: check if already subscribed to this topic at MQTT level? 
        // For now, just sending subscribe is safe.
        await connection.subscribe(topic, mqtt.QoS.AtLeastOnce);
        console.log(`Subscribed to ${topic}`);
    }, [connection]);

    const unsubscribe = useCallback(async (topic: string, handler?: TMessageHandler) => {
        if (handler) {
            messageHandlers.current.get(topic)?.delete(handler);
        }
        // Only unsubscribe from MQTT if no handlers left? 
        // For simplicity, we might keep the subscription open or logic here can be enhanced.
    }, []);

    // 3. Publish Logic
    const publish = useCallback(async (topic: string, payload: any) => {
        if (!connection) {
            addAlert("warning", "No MQTT connection");
            return;
        }
        const json = JSON.stringify(payload);
        await connection.publish(topic, json, mqtt.QoS.AtLeastOnce);
        console.log(`📤 Published to ${topic}`);
    }, [connection]);

    // Auto-connect on mount
    useEffect(() => {
        connect();
        return () => {
            disconnect();
        };
    }, []);

    return (
        <MQTTContext.Provider value={{ connection, isConnected, connect, disconnect, subscribe, unsubscribe, publish }}>
            {children}
        </MQTTContext.Provider>
    );
};

export const useMQTT = () => {
    const context = useContext(MQTTContext);
    if (!context) {
        throw new Error("useMQTT must be used within an MQTTProvider");
    }
    return context;
};
