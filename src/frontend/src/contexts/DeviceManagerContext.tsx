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
const SYSTEM_NOTIF_TOPIC = "system/notifications";
const DATA_TOPIC = "data_aquisition/sensor_data/rpi_data";
const DEVICE_ID = "d09454f7-6a4a-44af-9e0d-eb0bea17e9de"; // TODO: Move to config

// --- Types ---

interface IDeviceManagerContext {
    isRPIConnected: boolean;
    onlineDevices: Record<string, boolean>;
    sensorData: Record<string, ISensorReading>;
    pingDevice: () => void;
}

const DeviceManagerContext = createContext<IDeviceManagerContext | null>(null);

export const DeviceManagerProvider = ({ children }: { children: React.ReactNode }) => {
    const { subscribe, unsubscribe, publish, isConnected } = useMQTT();
    const { addAlert } = useAlert();

    const [isRPIConnected, setIsRPIConnected] = useState(false);
    const [onlineDevices, setOnlineDevices] = useState<Record<string, boolean>>({});
    const [sensorData, setSensorData] = useState<Record<string, ISensorReading>>({});

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

    return (
        <DeviceManagerContext.Provider value={{ isRPIConnected, onlineDevices, sensorData, pingDevice }}>
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