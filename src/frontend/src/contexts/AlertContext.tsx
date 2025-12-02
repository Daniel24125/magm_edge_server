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

import React, { createContext, useContext, useState, useCallback } from "react";
import { toast } from "sonner";
import { TAlert } from "@/types";

interface AlertContextType {
    alerts: TAlert[];
    addAlert: (type: TAlert["type"], message: string, details?: any) => void;
    removeAlert: (id: string) => void;
    clearAlerts: () => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

export const AlertProvider = ({ children }: { children: React.ReactNode }) => {
    const [alerts, setAlerts] = useState<TAlert[]>([]);

    const addAlert = useCallback((type: TAlert["type"], message: string, details?: any) => {
        const newAlert: TAlert = {
            id: crypto.randomUUID(),
            type,
            message,
            timestamp: new Date().toISOString(),
            details,
        };

        // 1. Update State (for a persistent "Notification Center" list if needed)
        setAlerts((prev) => [newAlert, ...prev]);

        // 2. Trigger Toast (for immediate feedback)
        switch (type) {
            case "success":
                toast.success(message);
                console.log(message)
                break;
            case "error":
                toast.error(message);
                console.error(message)
                break;
            case "warning":
                toast.warning(message);
                console.warn(message)
                break;
            case "info":
            default:
                toast.info(message);
                console.info(message)
                break;
        }
    }, []);

    const removeAlert = useCallback((id: string) => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
    }, []);

    const clearAlerts = useCallback(() => {
        setAlerts([]);
    }, []);

    return (
        <AlertContext.Provider value={{ alerts, addAlert, removeAlert, clearAlerts }}>
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