/**
 * SessionContext.tsx
 *
 * Responsibilities:
 * - Manages global session state (e.g., Session ID | Is Session Active | Session Data).
 * - Stores the current Session configuration.
 * - Handles high-level UI state (e.g., active wizard step).
 *
 * Usage:
 * Wrap the root layout with <SessionProvider> and use useSession()
 * in child components to access or update global state.
 */
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ISession, TMeasurement } from "@/types/sessions";
import { TAlert } from "@/types";
import { TSessionDetails, TSessionDefaultSettings, TAlertConfiguration, TProjectDetails } from "@/types/projects";
import { useMQTT } from "./MQTTContext";
import { useAlert } from "./AlertContext";
import { StartSessionDialog, StartSessionFormData } from "@/components/sessions/StartSessionDialog";
import { ProjectSelectionDialog } from "@/components/sessions/ProjectSelectionDialog";
import { useProjects } from "./ProjectsContext";
import { IProject } from "@/types/projects";
import { useDeviceManager } from "./DeviceManagerContext";
import { useUser } from "@auth0/nextjs-auth0";

interface SessionContextType {
    activeSession: ISession | null;
    isLoading: boolean;
    initiateSession: (projectId?: string) => void;
    startSession: (projectId: string, sessionDetails: TSessionDetails, settings: TSessionDefaultSettings, alertConfiguration: TAlertConfiguration[], notes?: string) => Promise<void>;
    stopSession: () => Promise<void>;
    pauseSession: () => Promise<void>;
    resumeSession: () => Promise<void>;
    addMeasurement: (measurement: TMeasurement) => void;
    addSessionAlert: (type: TAlert['type'], message: string, details?: Record<string, unknown>) => void;
    isSessionVerified: boolean;
    latestLiveMeasurement: TMeasurement | null;
    canPerformSession: boolean;
}

const SessionContext = createContext<SessionContextType | null>(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useUser()
    const { subscribe, unsubscribe, publish, isConnected } = useMQTT();
    const { addAlert } = useAlert();
    const { projects } = useProjects();
    const { sendCommand, isRPIConnected, onlineDevices } = useDeviceManager();
    const [activeSession, setActiveSession] = useState<ISession | null>(null);
    const [latestLiveMeasurement, setLatestLiveMeasurement] = useState<TMeasurement | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSessionVerified, setIsSessionVerified] = useState(false);
    const [isProjectSelectionOpen, setIsProjectSelectionOpen] = useState(false);
    const [isStartSessionDialogOpen, setIsStartSessionDialogOpen] = useState(false);


    const [pendingSessionStart, setPendingSessionStart] = useState<{
        projectId: string;
        sessionDetails: TSessionDetails;
        projectDetails: TProjectDetails;
        settings: TSessionDefaultSettings;
        alertConfiguration: TAlertConfiguration[];
    } | null>(null);

    // Keep a ref to the latest active session to safely read it in callbacks/effects without causing re-renders/looping
    const activeSessionRef = useRef(activeSession);
    useEffect(() => {
        activeSessionRef.current = activeSession;
    }, [activeSession]);

    const addSessionAlert = useCallback((type: TAlert['type'], message: string, details?: Record<string, unknown>) => {
        // 1. Add to global AlertContext (for toast/widget) - Clearable
        addAlert(type, message, 'session', details);

        // 2. Add to local activeSession state (for Table) - Persistent
        setActiveSession(prev => {
            if (!prev) return null;
            const newAlert: TAlert = {
                id: crypto.randomUUID(),
                type,
                category: 'session',
                message,
                timestamp: new Date().toISOString(),
                details,
                read: false
            };
            const currentAlerts = prev.alerts || [];
            return {
                ...prev,
                alerts: [newAlert, ...currentAlerts]
            };
        });
    }, [addAlert]);

    // Verify Connection via Device Status (Received via DeviceManager)
    // Subscription Effect - Dedicated Session Topic
    useEffect(() => {
        if (!isConnected) return;

        const sessionTopic = process.env.NEXT_PUBLIC_SESSION_TOPIC || "session/status";
        const historyTopic = "session/history";
        const liveTopic = "session/live";
        const alertsTopic = "session/alerts";

        const handleSessionMessage = (topic: string, rawMessage: unknown) => {
            console.log("Session Message Received:", topic, rawMessage);
            const message = rawMessage as { type?: string; payload?: any; history?: any[]; alerts?: any[]; data?: any; severity?: any; message?: string; sensor_type?: string; value?: any; timestamp?: string; session_time?: number };

            if (topic === sessionTopic) {
                // ... (existing logic)
                if (message.type === 'session') {
                    const payload = message.payload;
                    if (payload.active) {
                        setActiveSession(prev => {
                            if (prev && prev.id === payload.id) {
                                return {
                                    ...payload,
                                    measurements: payload.measurements?.length ? payload.measurements : prev.measurements,
                                    alerts: payload.alerts?.length ? payload.alerts : prev.alerts
                                }
                            }
                            return payload;
                        });
                        setIsSessionVerified(true);
                        // Once we know session is active, request history
                        publish("ui/commands/get_session_history", { command: "get_session_history", params: { id: payload.id } });
                    } else {
                        if (activeSessionRef.current && activeSessionRef.current.status === 'running') {
                            setActiveSession(null);
                        }
                        setIsSessionVerified(true);
                        setLatestLiveMeasurement(null);
                    }
                } else if (message.type === 'session_tick') {
                    const payload = message.payload;
                    setActiveSession(prev => {
                        if (!prev || prev.status !== 'running') return prev;
                        return { ...prev, time: payload.time }
                    })
                }
            } else if (topic === historyTopic) {
                // Handle History
                const history = message.history || [];
                const historyAlerts = message.alerts || [];
                console.log("Received Session History:", history.length, "measurements,", historyAlerts.length, "alerts");
                setActiveSession(prev => {
                    if (!prev) return null;

                    // Map history to TMeasurement
                    const historicalMeasurements: TMeasurement[] = history.map((r: any) => ({
                        timestamp: r.timestamp,
                        temperature: r.temp,
                        ph: r.ph,
                        od: r.od,
                        co2: r.co2,
                        session_time: r.session_time
                    }));

                    // Map history alerts to TAlert
                    const historicalAlerts: TAlert[] = historyAlerts.map((a: any) => ({
                        id: crypto.randomUUID(), // Or use ID from DB if available/needed
                        type: a.severity || "info",
                        category: "session",
                        message: a.message,
                        timestamp: a.timestamp,
                        details: {
                            source: a.sensor_type,
                            value: a.value
                        },
                        read: true // History alerts considered read? Or strictly purely based on ack? For now, persist state.
                    }));

                    return {
                        ...prev,
                        measurements: historicalMeasurements,
                        alerts: historicalAlerts
                    };
                });
            } else if (topic === liveTopic) {
                const data = message.data || {};

                // 1. Update Latest Live Measurement (for Wizard/Widgets)
                setLatestLiveMeasurement(prev => {
                    const { temp, ...rest } = data;
                    return {
                        ...prev,
                        ...rest,
                        temperature: temp !== undefined ? temp : prev?.temperature,
                        timestamp: message.timestamp,
                        session_time: message.session_time
                    } as TMeasurement
                });



            } else if (topic === alertsTopic) {
                addSessionAlert(
                    message.severity || "info",
                    message.message || "New Alert",
                    {
                        source: message.sensor_type || "System",
                        value: message.value,
                        ...message
                    }
                );
            }
        };

        subscribe(sessionTopic, handleSessionMessage);
        subscribe(historyTopic, handleSessionMessage);
        subscribe(liveTopic, handleSessionMessage);
        subscribe(alertsTopic, handleSessionMessage);

        // Request status
        publish("ui/commands/get_session_status", { command: "get_session_status" });

        return () => {
            unsubscribe(sessionTopic, handleSessionMessage);
            unsubscribe(historyTopic, handleSessionMessage);
            unsubscribe(liveTopic, handleSessionMessage);
            unsubscribe(alertsTopic, handleSessionMessage);
        }
    }, [isConnected, subscribe, unsubscribe, publish, addSessionAlert]); // Added addSessionAlert dependency


    const initiateSession = (projectId?: string) => {
        if (projectId) {
            const project = projects.find(p => p.id === projectId);
            if (project) {
                prepareStartSession(project);
            } else {
                addAlert("error", "Project not found");
            }
        } else {
            setIsProjectSelectionOpen(true);
        }
    };

    const handleProjectSelect = (project: IProject) => {
        setIsProjectSelectionOpen(false);
        prepareStartSession(project);
    };

    const prepareStartSession = (project: IProject) => {
        setPendingSessionStart({
            projectId: project.id,
            sessionDetails: project.sessionDetails,
            projectDetails: project.projectDetails,
            settings: project.sessionDefaultSettings,
            alertConfiguration: project.alertConfiguration
        });
        setIsStartSessionDialogOpen(true);
    };

    const startSession = async (projectId: string, sessionDetails: TSessionDetails, settings: TSessionDefaultSettings, alertConfiguration: TAlertConfiguration[], notes?: string) => {
        setIsLoading(true);
        try {
            const now = new Date().toISOString();
            // Generate ID locally (Offline-First)
            const sessionId = crypto.randomUUID();

            // Construct payload WITHOUT hitting Firebase
            const newSession: ISession = {
                id: sessionId,
                projectId,
                userId: user?.sub || "local-user", // Placeholder, will be overwritten by backend or ignored
                createdAt: now,
                updatedAt: now,
                sessionDetails,
                settings,
                alertConfiguration,
                status: 'running',
                notes,
                duration: 0,
                measurements: []
            };

            // Optimistic Update
            setActiveSession(newSession);

            console.log("Sending start session command to device (Offline-First)...");
            sendCommand("start_session", newSession as unknown as Record<string, unknown>);

            addSessionAlert("success", "Session started", { source: "User" });
        } catch (error) {
            console.error(error);
            addAlert("error", "An unexpected error occurred starting the session");
            setActiveSession(null);
        } finally {
            setIsLoading(false);
        }
    };

    const confirmStartSession = async (data: StartSessionFormData) => {
        if (!pendingSessionStart) return;

        setIsLoading(true);
        try {
            const now = new Date().toISOString();
            const sessionId = crypto.randomUUID();

            const newSession: ISession = {
                id: sessionId,
                projectId: pendingSessionStart.projectId,
                userId: user?.sub || "local-user",
                createdAt: now,
                updatedAt: now,
                sessionDetails: pendingSessionStart.sessionDetails,
                settings: {
                    ...data.settings,
                    ...(data.spectrometerConfig ? { spectrometer: data.spectrometerConfig } : {})
                },
                alertConfiguration: data.alertConfiguration,
                status: 'running',
                notes: data.notes,
                duration: pendingSessionStart.projectDetails.timer || 0,
                target: pendingSessionStart.projectDetails.target,
                measurements: []
            };

            setActiveSession(newSession);

            console.log("Sending start session command to device (Offline-First)...");
            sendCommand("start_session", newSession as unknown as Record<string, unknown>);

            addSessionAlert("success", "Session started", { source: "User" });
            setIsStartSessionDialogOpen(false);
            setPendingSessionStart(null);

        } catch (error) {
            console.error(error);
            addAlert("error", "An unexpected error occurred starting the session");
            setActiveSession(null);
        } finally {
            setIsLoading(false);
        }
    };

    const stopSession = async () => {
        if (!activeSession) return;
        setIsLoading(true);
        try {
            // Optimistic Update
            setActiveSession(null);
            sendCommand("stop_session", { "cmd": "stop_session" });
            addAlert("success", "Session stopped"); // Use simple alert as session is gone
        } catch (error) {
            console.error(error);
            addAlert("error", "An unexpected error occurred stopping the session");
        } finally {
            setIsLoading(false);
        }
    };

    const pauseSession = async () => {
        if (!activeSession) return;

        // Optimistic Update
        setActiveSession({ ...activeSession, status: 'paused' });

        try {
            console.log("Sending pause session command to device (Offline-First)...");
            sendCommand("pause_session", {
                command: "pause_session",
                params: { id: activeSession.id }
            });
            addSessionAlert("info", "Session paused", { source: "User" });
        } catch (error) {
            console.error(error);
            addAlert("error", "Failed to send pause command");
            // Revert on serious error if needed, but for fire-and-forget MQTT, usually we assume success or let the heartbeat correct it
        }
    };

    const resumeSession = async () => {
        if (!activeSession) return;

        // Optimistic Update
        setActiveSession({ ...activeSession, status: 'running' });

        try {
            console.log("Sending resume session command to device (Offline-First)...");
            sendCommand("resume_session", {
                command: "resume_session",
                params: { id: activeSession.id }
            });
            addSessionAlert("info", "Session resumed", { source: "User" });
        } catch (error) {
            console.error(error);
            addAlert("error", "Failed to send resume command");
        }
    };

    const addMeasurement = (measurement: TMeasurement) => {
        setActiveSession(prev => {
            if (!prev) return null;
            return {
                ...prev,
                measurements: [...prev.measurements, measurement]
            };
        });
    }



    const canPerformSession = useMemo(() => (!activeSession || activeSession.status === "paused") && !isLoading && isConnected && isSessionVerified && isRPIConnected && Object.keys(onlineDevices).length > 0,
        [activeSession, isLoading, isConnected, isSessionVerified, isRPIConnected, onlineDevices])

    return (
        <SessionContext.Provider value={{ activeSession, isLoading, initiateSession, startSession, stopSession, pauseSession, resumeSession, addMeasurement, addSessionAlert, isSessionVerified, latestLiveMeasurement, canPerformSession }}>
            {children}
            <ProjectSelectionDialog
                open={isProjectSelectionOpen}
                onOpenChange={setIsProjectSelectionOpen}
                onSelect={handleProjectSelect}
            />
            {pendingSessionStart && (
                <StartSessionDialog
                    open={isStartSessionDialogOpen}
                    onOpenChange={setIsStartSessionDialogOpen}
                    initialSettings={pendingSessionStart.settings}
                    initialAlerts={pendingSessionStart.alertConfiguration}
                    onConfirm={confirmStartSession}
                    isLoading={isLoading}
                />
            )}
        </SessionContext.Provider>
    );
};

export const useSession = () => {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error("useSession must be used within a SessionProvider");
    }
    return context;
};
