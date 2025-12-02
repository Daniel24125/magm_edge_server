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
import useWindowSize from "@/hooks/useWindowSize";

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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const isMobile = (windowSize.width || 0) < 768;



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
