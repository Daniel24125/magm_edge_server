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

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ISession, TMeasurement } from "@/types/sessions";
import { TSessionDetails, TSessionDefaultSettings, TAlertConfiguration } from "@/types/projects";
import { createSession, updateSession, getSessions } from "@/app/actions/sessions";
import { useMQTT } from "./MQTTContext";
import { useAlert } from "./AlertContext";
import { StartSessionDialog, StartSessionFormData } from "@/components/sessions/StartSessionDialog";
import { ProjectSelectionDialog } from "@/components/sessions/ProjectSelectionDialog";
import { useProjects } from "./ProjectsContext";
import { IProject } from "@/types/projects";

interface SessionContextType {
    activeSession: ISession | null;
    isLoading: boolean;
    initiateSession: (projectId?: string) => void;
    startSession: (projectId: string, sessionDetails: TSessionDetails, settings: TSessionDefaultSettings, alertConfiguration: TAlertConfiguration[], notes?: string) => Promise<void>;
    stopSession: () => Promise<void>;
    pauseSession: () => Promise<void>;
    resumeSession: () => Promise<void>;
    addMeasurement: (measurement: TMeasurement) => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
    const { subscribe, unsubscribe } = useMQTT();
    const { addAlert } = useAlert();
    const { projects } = useProjects();
    const [activeSession, setActiveSession] = useState<ISession | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Dialog States
    const [isProjectSelectionOpen, setIsProjectSelectionOpen] = useState(false);
    const [isStartSessionDialogOpen, setIsStartSessionDialogOpen] = useState(false);

    const [pendingSessionStart, setPendingSessionStart] = useState<{
        projectId: string;
        sessionDetails: TSessionDetails;
        settings: TSessionDefaultSettings;
        alertConfiguration: TAlertConfiguration[];
    } | null>(null);

    // Load active session on mount
    useEffect(() => {
        const loadActiveSession = async () => {
            setIsLoading(true);
            try {
                const result = await getSessions();
                if (result.success && result.data) {
                    const running = result.data.find(s => s.status === 'running' || s.status === 'paused');
                    if (running) {
                        console.log("Active session found:", running);
                        setActiveSession(running);
                    }
                }
            } catch (error) {
                console.error("Failed to load active session", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadActiveSession();
    }, []);

    const handleMeasurement = useCallback((topic: string, payload: any) => {
        if (!activeSession || activeSession.status !== 'running') return;

        const measurement: TMeasurement = {
            timestamp: new Date().toISOString(),
            temperature: payload.temperature,
            ph: payload.ph,
            od: payload.od,
            co2: payload.co2
        };

        setActiveSession(prev => {
            if (!prev) return null;
            return {
                ...prev,
                measurements: [...prev.measurements, measurement]
            };
        });
    }, [activeSession]);

    useEffect(() => {
        if (activeSession && activeSession.status === 'running') {
            const topic = "magm/+/data";
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
            const result = await createSession({
                projectId,
                sessionDetails,
                settings,
                alertConfiguration,
                status: 'running',
                notes,
                duration: 0
            });

            if (result.success && result.data) {
                setActiveSession(result.data);
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
            const result = await createSession({
                projectId: pendingSessionStart.projectId,
                sessionDetails: pendingSessionStart.sessionDetails,
                settings: data.settings,
                alertConfiguration: data.alertConfiguration,
                status: 'running',
                notes: data.notes,
                duration: 0
            });

            if (result.success && result.data) {
                setActiveSession(result.data);
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
        <SessionContext.Provider value={{ activeSession, isLoading, initiateSession, startSession, stopSession, pauseSession, resumeSession, addMeasurement }}>
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
