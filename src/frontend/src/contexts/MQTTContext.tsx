/**
 * MQTTContext.tsx
 *
 * Responsibilities:
 * - Exposes a global MQTT state (e.g., MQTT connection, messages, responses, subscriptions).
 * - Connects to local Mosquitto broker via WebSockets.
 */
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import mqtt, { MqttClient } from "mqtt";
import { useAlert } from "./AlertContext";


const getBrokerUrl = () => {
    // 1. Environment Variable Override (e.g. for ngrok)
    if (process.env.NEXT_PUBLIC_MQTT_BROKER_URL) return process.env.NEXT_PUBLIC_MQTT_BROKER_URL;

    // 2. Dynamic Browser-based detection
    if (typeof window !== "undefined") {
        // If offline, default to 127.0.0.1
        if (!navigator.onLine) {
            return "ws://127.0.0.1:9001";
        }
        const hostname = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
        return `ws://${hostname}:9001`;
    }
    return "ws://127.0.0.1:9001";
};

type TMessageHandler = (topic: string, payload: unknown) => void;

interface MQTTContextType {
    client: MqttClient | null;
    isConnected: boolean;
    connect: () => void;
    disconnect: () => void;
    subscribe: (topic: string, handler?: TMessageHandler) => void;
    unsubscribe: (topic: string, handler?: TMessageHandler) => void;
    publish: (topic: string, payload: unknown) => void;
}

const MQTTContext = createContext<MQTTContextType | null>(null);

export const MQTTProvider = ({ children }: { children: React.ReactNode }) => {
    const { addAlert } = useAlert();
    const [client, setClient] = useState<MqttClient | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Map of topic -> Set of handlers
    const messageHandlers = useRef<Map<string, Set<TMessageHandler>>>(new Map());
    const clientRef = useRef<MqttClient | null>(null);

    // 1. Connection Logic
    const connect = useCallback(() => {
        if (clientRef.current?.connected) return;

        const url = getBrokerUrl();
        console.log(`Connecting to MQTT broker at ${url}...`);

        const mqttClient = mqtt.connect(url, {
            clientId: "webclient-" + Math.floor(Math.random() * 100000),
            clean: true,
            reconnectPeriod: 2000, // Auto reconnect every 2s
            connectTimeout: 5000,
            keepalive: 60, // Keepalive 60s
            protocol: 'ws',
            path: '/mqtt' // Default mosquitto websockets path often needs this or empty, let's try standard
        });

        mqttClient.on("connect", () => {
            console.log("✅ Connected to Local MQTT Broker");
            setIsConnected(true);

            // Re-subscribe to all topics
            messageHandlers.current.forEach((_, topic) => {
                mqttClient.subscribe(topic, (err) => {
                    if (err) console.error(`Failed to resubscribe to ${topic}`, err);
                    else console.log(`Resubscribed to ${topic}`);
                });
            });
        });

        mqttClient.on("reconnect", () => {
            console.log("🔄 Reconnecting to MQTT Broker...");
        });

        mqttClient.on("close", () => {
            console.warn("🔌 Disconnected from MQTT Broker");
            setIsConnected(false);
        });

        mqttClient.on("offline", () => {
            console.warn("⚠️ MQTT Client Offline");
            setIsConnected(false);
        });

        mqttClient.on("error", (err) => {
            console.error("❌ MQTT Connection Error:", err);
            // Do not call end() here, let the client try to reconnect
        });

        mqttClient.on("message", (topic, payload) => {
            try {
                const payloadStr = payload.toString();
                // console.log(`📩 Received on ${topic}:`, payloadStr);
                const parsed = JSON.parse(payloadStr);

                // Dispatch to handlers
                // Support wildcards/regex in future if needed, currently exact match + basic routing
                // Simple exact match for now as per previous implementation
                const handlers = messageHandlers.current.get(topic);
                if (handlers) {
                    handlers.forEach(h => h(topic, parsed));
                }

                // Also support simple wildcard matching (e.g. users subscribing to /#)
                // (Not fully implemented here for simplicity unless needed)
            } catch (e: unknown) {
                console.error("Failed to parse message", e);
            }
        });

        clientRef.current = mqttClient;
        setClient(mqttClient);

    }, []);

    const disconnect = useCallback(() => {
        if (clientRef.current) {
            console.warn("🔻 Disconnecting MQTT Client...");
            clientRef.current.end(true);
            clientRef.current = null;
            setClient(null);
            setIsConnected(false);
        }
    }, []);

    // 2. Subscribe Logic
    const subscribe = useCallback((topic: string, handler?: TMessageHandler) => {
        if (!topic) return;

        // Register handler
        if (handler) {
            if (!messageHandlers.current.has(topic)) {
                messageHandlers.current.set(topic, new Set());
            }
            messageHandlers.current.get(topic)?.add(handler);
        }

        // Perform Subscription
        if (clientRef.current?.connected) {
            clientRef.current.subscribe(topic, { qos: 1 }, (err) => {
                if (err) console.error(`Subscribe error for ${topic}:`, err);
                // else console.log(`Subscribed to ${topic}`);
            });
        }
    }, []);

    const unsubscribe = useCallback((topic: string, handler?: TMessageHandler) => {
        if (handler) {
            messageHandlers.current.get(topic)?.delete(handler);
        }
        // Optional: Unsubscribe from broker if no handlers left
    }, []);

    // 3. Publish Logic
    const publish = useCallback((topic: string, payload: unknown) => {
        if (!clientRef.current?.connected) {
            console.warn("Cannot publish: No info connection");
            return;
        }
        const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
        clientRef.current.publish(topic, msg, { qos: 1 }, (err) => {
            if (err) console.error("Publish error:", err);
        });
    }, []);

    // Heartbeat / Keepalive
    useEffect(() => {
        if (!isConnected || !client) return;

        const heartbeatInterval = setInterval(() => {
            if (client.connected) {
                // Publish a lightweight ping to keep the connection active
                // qos: 0 is sufficient for keepalive
                client.publish("ui/heartbeat", JSON.stringify({ timestamp: Date.now() }), { qos: 0 }, (err) => {
                    if (err) console.warn("Heartbeat failed", err);
                });
            }
        }, 10000); // 10 seconds

        return () => clearInterval(heartbeatInterval);
    }, [isConnected, client]);

    // Auto-connect
    useEffect(() => {
        connect();
        return () => {
            console.warn("⚠️ MQTT Provider Unmounting - Disconnecting...");
            disconnect();
        };
    }, []); // Run once on mount

    return (
        <MQTTContext.Provider value={{ client, isConnected, connect, disconnect, subscribe, unsubscribe, publish }}>
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
