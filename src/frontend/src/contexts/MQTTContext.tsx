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

type TMessageHandler = (topic: string, payload: unknown) => void;

interface MQTTContextType {
    connection: mqtt.MqttClientConnection | null;
    isConnected: boolean;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    subscribe: (topic: string, handler?: TMessageHandler) => Promise<void>;
    unsubscribe: (topic: string, handler?: TMessageHandler) => Promise<void>;
    publish: (topic: string, payload: unknown) => Promise<void>;
}

const MQTTContext = createContext<MQTTContextType | null>(null);

export const MQTTProvider = ({ children }: { children: React.ReactNode }) => {
    const { addAlert } = useAlert();
    const [connection, setConnection] = useState<mqtt.MqttClientConnection | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const messageHandlers = useRef<Map<string, Set<TMessageHandler>>>(new Map());

    // Refs to track connection state independent of React renders
    const connectionRef = useRef<mqtt.MqttClientConnection | null>(null);
    const isConnecting = useRef(false);

    // 1. Connection Logic
    const connect = useCallback(async () => {
        if (isConnecting.current || connectionRef.current) return;

        isConnecting.current = true;

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

            newConnection.on("interrupt", (error) => {
                console.warn("⚠️ MQTT Connection Interrupted:", error);
                setIsConnected(false);
            });

            newConnection.on("resume", (return_code, session_present) => {
                console.log("♻️ MQTT Connection Resumed", { return_code, session_present });
                setIsConnected(true);

                // Re-subscribe to all topics since we use clean_session=true
                messageHandlers.current.forEach((_, topic) => {
                    newConnection.subscribe(topic, mqtt.QoS.AtLeastOnce)
                        .then(() => console.log(`Resubscribed to ${topic}`))
                        .catch(e => console.error(`Failed to resubscribe to ${topic}`, e));
                });
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
                } catch (e: unknown) {
                    const error = e instanceof Error ? e : new Error(String(e));
                    addAlert("error", "Failed to parse MQTT message " + error.message, "app");
                }
            });

            await newConnection.connect();
            connectionRef.current = newConnection;
            setConnection(newConnection);

        } catch (error) {
            console.error("❌ MQTT Connection Failed:", error);
        } finally {
            isConnecting.current = false;
        }
    }, []);

    const disconnect = useCallback(async () => {
        if (connectionRef.current) {
            await connectionRef.current.disconnect();
            connectionRef.current = null;
            setConnection(null);
            setIsConnected(false);
        }
    }, []);

    // 2. Subscribe Logic
    const subscribe = useCallback(async (topic: string, handler?: TMessageHandler) => {
        if (!connectionRef.current) {
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

        // // Perform MQTT subscription (idempotent-ish)
        // // We always subscribe at least once. 
        // // Optimization: check if already subscribed to this topic at MQTT level? 
        // // For now, just sending subscribe is safe.

        // console.log("MQTTContext: Subscribing...", { topic, qos: mqtt.QoS.AtLeastOnce, connection: !!connectionRef.current });
        try {
            await connectionRef.current.subscribe(topic, mqtt.QoS.AtLeastOnce);
        } catch (e) {
            console.error("MQTT Subscribe Error:", e);
        }
        // console.log(`Subscribed to ${topic}`);
    }, []);

    const unsubscribe = useCallback(async (topic: string, handler?: TMessageHandler) => {
        if (handler) {
            messageHandlers.current.get(topic)?.delete(handler);
        }
        // Only unsubscribe from MQTT if no handlers left? 
        // For simplicity, we might keep the subscription open or logic here can be enhanced.
    }, []);

    // 3. Publish Logic
    const publish = useCallback(async (topic: string, payload: unknown) => {
        if (!connectionRef.current) {
            addAlert("warning", "No MQTT connection");
            return;
        }
        const json = JSON.stringify(payload);
        await connectionRef.current.publish(topic, json, mqtt.QoS.AtLeastOnce);
        console.log(`📤 Published to ${topic}`);
    }, []);

    // Auto-connect on mount and handle window events
    useEffect(() => {
        connect();

        const handleOnline = () => {
            console.log("🌐 Browser is online, attempting reconnect...");
            connect();
        };

        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('online', handleOnline);
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
