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

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { ISession, TMeasurement } from "@/types/sessions";
import { TSessionDetails, TSessionDefaultSettings, TAlertConfiguration } from "@/types/projects";
import { createSession, updateSession } from "@/app/actions/sessions";
import { useMQTT } from "./MQTTContext";
import { useAlert } from "./AlertContext";
import { StartSessionDialog, StartSessionFormData } from "@/components/sessions/StartSessionDialog";
import { ProjectSelectionDialog } from "@/components/sessions/ProjectSelectionDialog";
import { useProjects } from "./ProjectsContext";
import { IProject } from "@/types/projects";
import { useDeviceManager } from "./DeviceManagerContext";

interface SessionContextType {
    activeSession: ISession | null;
    isLoading: boolean;
    initiateSession: (projectId?: string) => void;
    startSession: (projectId: string, sessionDetails: TSessionDetails, settings: TSessionDefaultSettings, alertConfiguration: TAlertConfiguration[], notes?: string) => Promise<void>;
    stopSession: () => Promise<void>;
    pauseSession: () => Promise<void>;
    resumeSession: () => Promise<void>;
    addMeasurement: (measurement: TMeasurement) => void;
    isSessionVerified: boolean;
    latestLiveMeasurement: TMeasurement | null;
}

const SessionContext = createContext<SessionContextType | null>(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
    const { subscribe, unsubscribe, publish, isConnected } = useMQTT();
    const { addAlert } = useAlert();
    const { projects } = useProjects();
    const { sendCommand } = useDeviceManager();
    const [activeSession, setActiveSession] = useState<ISession | null>(null);
    const [latestLiveMeasurement, setLatestLiveMeasurement] = useState<TMeasurement | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSessionVerified, setIsSessionVerified] = useState(false);
    const [isProjectSelectionOpen, setIsProjectSelectionOpen] = useState(false);
    const [isStartSessionDialogOpen, setIsStartSessionDialogOpen] = useState(false);

    const [pendingSessionStart, setPendingSessionStart] = useState<{
        projectId: string;
        sessionDetails: TSessionDetails;
        settings: TSessionDefaultSettings;
        alertConfiguration: TAlertConfiguration[];
    } | null>(null);

    // Keep a ref to the latest active session to safely read it in callbacks/effects without causing re-renders/looping
    const activeSessionRef = useRef(activeSession);
    useEffect(() => {
        activeSessionRef.current = activeSession;
    }, [activeSession]);

    // Verify Connection via Device Status (Received via DeviceManager)
    // Subscription Effect - Dedicated Session Topic
    useEffect(() => {
        if (!isConnected) return;

        const sessionTopic = process.env.NEXT_PUBLIC_SESSION_TOPIC || "session/status";
        const historyTopic = "session/history";
        const liveTopic = "session/live";

        const handleSessionMessage = (topic: string, message: any) => {
            // console.log("Session Message:", topic, message);

            if (topic === sessionTopic) {
                // ... (existing logic)
                if (message.type === 'session') {
                    const payload = message.payload;
                    if (payload.active) {
                        setActiveSession(payload);
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
                console.log("Received Session History:", history.length, "records");

                setActiveSession(prev => {
                    if (!prev) return null; // Should we set it if null? Maybe not.
                    // Map history to TMeasurement
                    const historicalMeasurements: TMeasurement[] = history.map((r: any) => ({
                        timestamp: r.timestamp,
                        temperature: r.temp,
                        ph: r.ph,
                        od: r.od,
                        co2: r.co2
                    }));

                    return {
                        ...prev,
                        measurements: historicalMeasurements
                    };
                });
            } else if (topic === liveTopic) {
                // Handle Live Data (Partial or Full)
                const data = message.data || {};
                setLatestLiveMeasurement(prev => ({
                    ...prev,
                    ...data, // Merge new data
                    timestamp: message.timestamp // Update timestamp
                } as TMeasurement));
            }
        };

        subscribe(sessionTopic, handleSessionMessage);
        subscribe(historyTopic, handleSessionMessage);
        subscribe(liveTopic, handleSessionMessage);

        // Request status
        publish("ui/commands/get_session_status", { command: "get_session_status" });

        return () => {
            unsubscribe(sessionTopic, handleSessionMessage);
            unsubscribe(historyTopic, handleSessionMessage);
            unsubscribe(liveTopic, handleSessionMessage);
        }
    }, [isConnected, subscribe, unsubscribe, publish]);
    // Stable callback for handling measurements
    const handleMeasurement = useCallback((topic: string, payload: any) => {
        const currentSession = activeSessionRef.current;
        if (!currentSession || currentSession.status !== 'running') return;

        console.log("Received measurement:", payload);
        const data = payload.data || {};

        // Use functional update to avoid dependency on activeSession
        setActiveSession(prev => {
            if (!prev) return null;

            const measurement: TMeasurement = {
                timestamp: payload.timestamp || new Date().toISOString(),
                temperature: data.temp,
                ph: data.ph,
                od: data.od,
                co2: data.co2
            };

            return {
                ...prev,
                measurements: [...prev.measurements, measurement]
            };
        });
    }, []);

    // Subscription Effect - Only re-subscribes if CRITICAL ID/Status changes, not time/measurements
    useEffect(() => {
        const shouldSubscribe = activeSession?.status === 'running';
        const topic = process.env.NEXT_PUBLIC_DATA_TOPIC || "";

        if (shouldSubscribe && topic) {
            subscribe(topic, handleMeasurement);

            return () => {
                unsubscribe(topic, handleMeasurement);
            }
        }
    }, [activeSession?.id, activeSession?.status, subscribe, unsubscribe, handleMeasurement]);

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
            settings: project.sessionDefaultSettings,
            alertConfiguration: project.alertConfiguration
        });
        setIsStartSessionDialogOpen(true);
    };

    const startSession = async (projectId: string, sessionDetails: TSessionDetails, settings: TSessionDefaultSettings, alertConfiguration: TAlertConfiguration[], notes?: string) => {
        setIsLoading(true);
        try {
            const payload: Omit<ISession, "id" | "userId" | "createdAt" | "updatedAt" | "measurements"> = {
                projectId,
                sessionDetails,
                settings,
                alertConfiguration,
                status: 'running',
                notes,
                duration: 0
            }
            const result = await createSession(payload);

            if (result.success && result.data) {
                setActiveSession(result.data);
                console.log(result.data)
                console.log("Sending start session command to device...")
                sendCommand(`${process.env.NEXT_PUBLIC_COMMAND_TOPIC}/start_session`, {
                    ...payload,
                    id: result.data.id
                });
                addAlert("success", "Session started successfully");
            } else {
                addAlert("error", result.error || "Failed to start session");
            }
        } catch (error) {
            console.error(error);
            addAlert("error", "An unexpected error occurred starting the session");
        } finally {
            setIsLoading(false);
        }
    };

    const confirmStartSession = async (data: StartSessionFormData) => {
        if (!pendingSessionStart) return;

        setIsLoading(true);
        try {
            const payload: Omit<ISession, "id" | "userId" | "createdAt" | "updatedAt" | "measurements"> = {
                projectId: pendingSessionStart.projectId,
                sessionDetails: pendingSessionStart.sessionDetails,
                settings: data.settings,
                alertConfiguration: data.alertConfiguration,
                status: 'running',
                notes: data.notes,
                duration: 0
            }
            const result = await createSession(payload);

            if (result.success && result.data) {
                setActiveSession(result.data);
                console.log("Sending start session command to device...")
                sendCommand("start_session", {
                    ...payload,
                    id: result.data.id
                });
                addAlert("success", "Session started successfully");
                setIsStartSessionDialogOpen(false);
                setPendingSessionStart(null);
            } else {
                addAlert("error", result.error || "Failed to start session");
            }
        } catch (error) {
            console.error(error);
            addAlert("error", "An unexpected error occurred starting the session");
        } finally {
            setIsLoading(false);
        }
    };

    const stopSession = async () => {
        if (!activeSession) return;
        setIsLoading(true);
        try {
            const result = await updateSession(activeSession.id, { status: 'completed' });
            if (result.success) {
                setActiveSession(null);
                addAlert("success", "Session stopped successfully");
                sendCommand("stop_session", { "cmd": "stop_session" });
            } else {
                addAlert("error", result.error || "Failed to stop session");
            }
        } catch (error) {
            console.error(error);
            addAlert("error", "An unexpected error occurred stopping the session");
        } finally {
            setIsLoading(false);
        }
    };

    const pauseSession = async () => {
        if (!activeSession) return;
        const prevSession = activeSession;
        setActiveSession({ ...activeSession, status: 'paused' });

        try {
            const result = await updateSession(activeSession.id, { status: 'paused' });
            if (!result.success) {
                setActiveSession(prevSession);
                addAlert("error", result.error || "Failed to pause session");
            }
        } catch (error) {
            setActiveSession(prevSession);
            addAlert("error", "Failed to pause session");
        }
    };

    const resumeSession = async () => {
        if (!activeSession) return;
        const prevSession = activeSession;
        setActiveSession({ ...activeSession, status: 'running' });

        try {
            const result = await updateSession(activeSession.id, { status: 'running' });
            if (!result.success) {
                setActiveSession(prevSession);
                addAlert("error", result.error || "Failed to resume session");
            }
        } catch (error) {
            setActiveSession(prevSession);
            addAlert("error", "Failed to resume session");
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



    return (
        <SessionContext.Provider value={{ activeSession, isLoading, initiateSession, startSession, stopSession, pauseSession, resumeSession, addMeasurement, isSessionVerified, latestLiveMeasurement }}>
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
