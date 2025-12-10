/**
 * AlertContext.tsx
 *
 * Responsibilities:
 * - Manages global alert state (e.g., Notifications | Sensor Errors | User alerts).
 * - Stores the current Alert configuration.
 * - Integrates with 'sonner' for toast notifications.
 * 
 * Usage:
 * Wrap the root layout with <AlertProvider> and use useAlert()
 * in child components to access or update global state.
 */
"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { TAlert } from "@/types";
import { useMQTT } from "./MQTTContext";

interface AlertContextType {
    alerts: TAlert[];
    addAlert: (type: TAlert["type"], message: string, category?: TAlert["category"], details?: any) => void;
    removeAlert: (id: string) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearAlerts: (category?: TAlert["category"]) => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

export const AlertProvider = ({ children }: { children: React.ReactNode }) => {
    const [alerts, setAlerts] = useState<TAlert[]>([]);


    const requestNotificationPermission = useCallback(async () => {
        if (!("Notification" in window)) return false;
        if (Notification.permission === "granted") return true;
        if (Notification.permission !== "denied") {
            const permission = await Notification.requestPermission();
            return permission === "granted";
        }
        return false;
    }, []);

    const sendBrowserNotification = useCallback(async (title: string, body: string) => {
        const hasPermission = await requestNotificationPermission();
        if (hasPermission) {
            new Notification(title, { body, icon: "/icon.png" }); // Ensure icon exists or remove
        }
    }, [requestNotificationPermission]);

    const addAlert = useCallback((type: TAlert["type"], message: string, category: TAlert["category"] = "app", details?: any) => {
        const newAlert: TAlert = {
            id: crypto.randomUUID(),
            type,
            category,
            message,
            timestamp: new Date().toISOString(),
            details,
            read: false,
        };

        setAlerts((prev) => [newAlert, ...prev]);

        // Browser Notification for important alerts
        if (type === "error" || type === "warning") {
            sendBrowserNotification(`MAGM Alert: ${type.toUpperCase()}`, message);
        }

        // Toast
        switch (type) {
            case "success": toast.success(message); break;
            case "error": toast.error(message); break;
            case "warning": toast.warning(message); break;
            case "info":
            default: toast.info(message); break;
        }
    }, [sendBrowserNotification]);

    const removeAlert = useCallback((id: string) => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
    }, []);

    const markAsRead = useCallback((id: string) => {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
    }, []);

    const markAllAsRead = useCallback(() => {
        setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    }, []);

    const clearAlerts = useCallback((category?: TAlert["category"]) => {
        setAlerts(prev => category ? prev.filter(a => a.category !== category) : []);
    }, []);

    return (
        <AlertContext.Provider value={{ alerts, addAlert, removeAlert, clearAlerts, markAsRead, markAllAsRead }}>
            {children}
        </AlertContext.Provider>
    );
};

export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error("useAlert must be used within an AlertProvider");
    }
    return context;
};