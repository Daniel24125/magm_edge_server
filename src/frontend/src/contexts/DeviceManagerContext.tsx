/**
 * DeviceManagerContext.tsx
 *
 * Responsibilities:
 * - Manages global device state (e.g., Device status | Device data | Device configuration | Device Calibration).
 * - Stores the current Device configuration.
 * - Manages the RPi connection state.
 * - Manages the sensor connection (pH, Temperature, Spectrometer).
 *
 * Usage:
 * Wrap the root layout with <DeviceManagerProvider> and use useDeviceManager()
 * in child components to access or update global state.
 */
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useMQTT } from "./MQTTContext";
import { useAlert } from "./AlertContext";
import { ISensorReading } from "@/types";

// --- Constants ---
const SYSTEM_NOTIF_TOPIC = process.env.NEXT_PUBLIC_SYSTEM_NOTIF_TOPIC || ""
const DATA_TOPIC = process.env.NEXT_PUBLIC_DATA_TOPIC || ""
const DEVICE_ID = process.env.NEXT_PUBLIC_DEVICE_ID || ""


// --- Types ---

interface IDeviceManagerContext {
    isRPIConnected: boolean;
    onlineDevices: Record<string, boolean>;
    sensorData: Record<string, ISensorReading>;
    lastSystemNotification: any;
    pingDevice: () => void;
    sendCommand: (command: string, params: Record<string, any>) => void;
}

const DeviceManagerContext = createContext<IDeviceManagerContext | null>(null);
const COMMAND_TOPIC = process.env.NEXT_PUBLIC_COMMAND_TOPIC || "";

export const DeviceManagerProvider = ({ children }: { children: React.ReactNode }) => {
    const { subscribe, unsubscribe, publish, isConnected } = useMQTT();
    const { addAlert } = useAlert();

    const [isRPIConnected, setIsRPIConnected] = useState(false);
    const [onlineDevices, setOnlineDevices] = useState<Record<string, boolean>>({});
    const [sensorData, setSensorData] = useState<Record<string, ISensorReading>>({});
    const [lastSystemNotification, setLastSystemNotification] = useState<any>(null);

    // --- Actions ---
    const pingDevice = useCallback(() => {
        if (!isConnected) return;
        const topic = `ui/commands/ping_device`;
        publish(topic, JSON.stringify({ command: "ping_device", params: { device_id: DEVICE_ID } }));
    }, [isConnected, publish]);

    // --- Subscriptions ---
    useEffect(() => {
        if (!isConnected) return;

        // 1. System Notifications (Connection Status)
        const handleSystemNotification = (topic: string, payload: any) => {
            console.log("🔔 System Notification:", payload);
            setLastSystemNotification(payload);

            if (payload.event === "rpi_connected") {
                setIsRPIConnected(true);
                addAlert("success", "RPi Connected");
            }
            if (payload.event === "rpi_disconnected") {
                setIsRPIConnected(false);
                setOnlineDevices({});
                addAlert("warning", "RPi Disconnected");
            }
            if (payload.event === "device_connected") {
                setOnlineDevices(payload.devices_online || {});
                addAlert("info", payload.message || "Device Connected");
            }
            if (payload.event === "device_disconnected") {
                setOnlineDevices(payload.devices_online || {});
                addAlert("warning", payload.message || "Device Disconnected");
            }
        };

        // 2. Sensor Data
        const handleSensorData = (topic: string, payload: any) => {
            // Payload structure: { data: { ph: { value: 7.0 }, temp: { value: 25.0 } }, timestamp: "..." }
            if (payload.data) {
                const timestamp = payload.timestamp || new Date().toISOString();
                const newReadings: Record<string, ISensorReading> = {};

                Object.entries(payload.data).forEach(([sensorType, data]: [string, any]) => {
                    newReadings[sensorType] = {
                        value: data.value,
                        unit: data.unit,
                        timestamp,
                        status: data.status
                    };
                });

                setSensorData(prev => ({ ...prev, ...newReadings }));
            }
        };

        subscribe(SYSTEM_NOTIF_TOPIC, handleSystemNotification);
        subscribe(DATA_TOPIC, handleSensorData);

        // Initial Ping
        pingDevice();

        return () => {
            unsubscribe(SYSTEM_NOTIF_TOPIC, handleSystemNotification);
            unsubscribe(DATA_TOPIC, handleSensorData);
        }
    }, [isConnected, subscribe, unsubscribe, pingDevice, addAlert]);

    // 5️⃣ Send command to device
    const sendCommand = useCallback((command: string, params: Record<string, any> = {}) => {
        console.log("Sending command to device...")
        if (!isRPIConnected || !isConnected) {
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
    }, [isRPIConnected, isConnected])
    return (
        <DeviceManagerContext.Provider value={{ isRPIConnected, onlineDevices, sensorData, lastSystemNotification, pingDevice, sendCommand }}>
            {children}
        </DeviceManagerContext.Provider>
    );
};

export const useDeviceManager = () => {
    const context = useContext(DeviceManagerContext);
    if (!context) {
        throw new Error("useDeviceManager must be used within a DeviceManagerProvider");
    }
    return context;
};