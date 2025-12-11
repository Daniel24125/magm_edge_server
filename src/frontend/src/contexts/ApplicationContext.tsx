/**
 * ApplicationContext.tsx
 *
 * Responsibilities:
 * - Manages global UI state (Window Size, Page Title, Sidebar State).
 * - Provides a central place for layout-related data.
 *
 * Usage:
 * Wrap the root layout with <ApplicationProvider> and use useApplication()
 * in child components.
 */
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useMQTT } from "./MQTTContext";
import { useAlert } from "./AlertContext";
import useWindowSize from "@/hooks/useWindowSize";
import { usePathname } from "next/navigation";

interface IApplicationContext {
    // Window Size
    windowSize: { width: number; height: number };
    isMobile: boolean;

    // Page Title
    pageTitle: string;
    setPageTitle: (title: string) => void;

    // Sidebar State
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    closeSidebar: () => void;
    openSidebar: () => void;
}

const ApplicationContext = createContext<IApplicationContext | null>(null);

export const ApplicationProvider = ({ children }: { children: React.ReactNode }) => {
    const windowSize = useWindowSize();
    const [pageTitle, setPageTitle] = useState("Dashboard");
    const { subscribe, unsubscribe, isConnected } = useMQTT();
    const { addAlert } = useAlert();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const isMobile = (windowSize.width || 0) < 768;
    const pathname = usePathname();

    const ROUTE_TITLES: Record<string, string> = {
        "/": "Dashboard",
        "/projects": "Projects",
        "/devices": "Devices",
        "/notifications": "Notifications",
        "/settings": "Settings",
        "/session": "Session Details",
    };

    useEffect(() => {
        const title = ROUTE_TITLES[pathname] || "Dashboard";
        setPageTitle(title);
    }, [pathname]);

    useEffect(() => {
        if (!isConnected) return;

        const handleAlert = (topic: string, payload: any) => {
            const msg = payload.message || JSON.stringify(payload);
            const category = payload.source === 'edge' ? 'app' : 'session';

            // Use explicit severity if available, else fallback to inference
            let alertType: "info" | "warning" | "error" | "success" = payload.severity as any;

            if (!alertType) {
                alertType = "info";
                if (payload.sensor_type) alertType = "warning";
                if (payload.event === "rpi_disconnected") alertType = "error";
                if (payload.event === "rpi_connected") alertType = "success";
            }

            addAlert(alertType, msg, category, payload);
        };

        subscribe("ui/alerts", handleAlert);
        subscribe("system/notifications", handleAlert);

        return () => {
            unsubscribe("ui/alerts", handleAlert);
            unsubscribe("system/notifications", handleAlert);
        };
    }, [isConnected, subscribe, unsubscribe, addAlert]);



    const toggleSidebar = useCallback(() => setIsSidebarOpen((prev) => !prev), []);
    const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
    const openSidebar = useCallback(() => setIsSidebarOpen(true), []);

    return (
        <ApplicationContext.Provider
            value={{
                windowSize,
                isMobile,
                pageTitle,
                setPageTitle,
                isSidebarOpen,
                toggleSidebar,
                closeSidebar,
                openSidebar,
            }}
        >
            {children}
        </ApplicationContext.Provider>
    );
};

export const useApplication = () => {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error("useApplication must be used within an ApplicationProvider");
    }
    return context;
};
