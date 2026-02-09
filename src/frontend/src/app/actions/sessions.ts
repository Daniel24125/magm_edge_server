"use server";

import { auth0 } from "@/lib/auth0";
import { db } from "@/services/firebase";
import { ISession, TMeasurement } from "@/types/sessions";
import { TAlert } from "@/types";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

const COLLECTION_NAME = "sessions";

export async function getSessions(projectId?: string): Promise<{ success: boolean; data?: ISession[]; error?: string }> {
    try {
        const session = await auth0.getSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        let query = db.collection(COLLECTION_NAME).where("userId", "==", session.user.sub);

        if (projectId) {
            query = query.where("projectId", "==", projectId);
        }

        const snapshot = await query.get();

        const sessions: ISession[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data
            } as ISession;
        });

        return { success: true, data: sessions };
    } catch (error) {
        console.error("Error fetching sessions:", error);
        return { success: false, error: "Failed to fetch sessions" };
    }
}

export async function createSession(sessionData: Omit<ISession, "id" | "createdAt" | "updatedAt" | "userId" | "measurements">): Promise<{ success: boolean; data?: ISession; error?: string }> {
    try {
        const session = await auth0.getSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const now = new Date().toISOString();
        const newSession = {
            ...sessionData,
            userId: session.user.sub,
            createdAt: now,
            updatedAt: now,
            measurements: []
        };

        const docRef = await db.collection(COLLECTION_NAME).add(newSession);

        const createdSession: ISession = {
            id: docRef.id,
            ...newSession,
        } as ISession;

        revalidatePath("/projects"); // Revalidate projects page as sessions might be listed there
        return { success: true, data: createdSession };
    } catch (error) {
        console.error("Error creating session:", error);
        return { success: false, error: "Failed to create session" };
    }
}

export async function updateSession(id: string, sessionData: Partial<ISession>): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth0.getSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        console.log(id)
        const docRef = db.collection(COLLECTION_NAME).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return { success: false, error: "Session not found" };
        }

        if (doc.data()?.userId !== session.user.sub) {
            return { success: false, error: "Unauthorized" };
        }

        await docRef.update({
            ...sessionData,
            updatedAt: new Date().toISOString(),
        });

        revalidatePath("/projects");
        return { success: true };
    } catch (error) {
        console.error("Error updating session:", error);
        return { success: false, error: "Failed to update session" };
    }
}

export async function deleteSession(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth0.getSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const docRef = db.collection(COLLECTION_NAME).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return { success: false, error: "Session not found" };
        }

        if (doc.data()?.userId !== session.user.sub) {
            return { success: false, error: "Unauthorized" };
        }

        await docRef.delete();
        revalidatePath("/projects");
        return { success: true };
    } catch (error) {
        console.error("Error deleting session:", error);
        return { success: false, error: "Failed to delete session" };
    }
}

export async function getSessionMeasurements(sessionId: string): Promise<{ success: boolean; data?: TMeasurement[]; error?: string }> {
    try {
        const session = await auth0.getSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const sessionDocRef = db.collection(COLLECTION_NAME).doc(sessionId);
        const sessionDoc = await sessionDocRef.get();

        if (!sessionDoc.exists) {
            return { success: false, error: "Session not found" };
        }

        if (sessionDoc.data()?.userId !== session.user.sub) {
            return { success: false, error: "Unauthorized" };
        }

        const measurementsSnapshot = await sessionDocRef.collection("measurements").orderBy("timestamp", "desc").get();

        const measurements: TMeasurement[] = measurementsSnapshot.docs.map(doc => {
            const docData = doc.data();
            let finalData: any = { ...docData };

            // Consolidate data if nested
            if (docData.data && typeof docData.data === 'object') {
                finalData = {
                    ...finalData,
                    ...docData.data // flattened
                };
            }

            // Standardize Keys: 'temp' -> 'temperature'
            if (finalData.temp !== undefined && finalData.temperature === undefined) {
                finalData.temperature = finalData.temp;
            }

            return finalData as TMeasurement;
        });

        return { success: true, data: measurements };
    } catch (error) {
        console.error("Error fetching measurements:", error);
        return { success: false, error: "Failed to fetch measurements" };
    }
}

export async function getSessionAlerts(sessionId: string): Promise<{ success: boolean; data?: TAlert[]; error?: string }> {
    try {
        const session = await auth0.getSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const sessionDocRef = db.collection(COLLECTION_NAME).doc(sessionId);
        const sessionDoc = await sessionDocRef.get();

        if (!sessionDoc.exists) {
            return { success: false, error: "Session not found" };
        }

        if (sessionDoc.data()?.userId !== session.user.sub) {
            return { success: false, error: "Unauthorized" };
        }

        // Fetch alerts from subcollection
        const alertsSnapshot = await sessionDocRef.collection("alerts").orderBy("timestamp", "desc").get();

        const alerts: TAlert[] = alertsSnapshot.docs.map(doc => {
            return {
                id: doc.id,
                ...doc.data()
            } as TAlert;
        });

        return { success: true, data: alerts };
    } catch (error) {
        console.error("Error fetching alerts:", error);
        return { success: false, error: "Failed to fetch alerts" };
    }
}

export async function exportSessionToExcel(sessionId: string): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
        const session = await auth0.getSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const sessionDocRef = db.collection(COLLECTION_NAME).doc(sessionId);
        const sessionDoc = await sessionDocRef.get();

        if (!sessionDoc.exists) {
            return { success: false, error: "Session not found" };
        }

        const sessionData = { id: sessionDoc.id, ...sessionDoc.data() } as ISession;

        if (sessionData.userId !== session.user.sub) {
            return { success: false, error: "Unauthorized" };
        }

        // Fetch subcollections and Project info concurrently
        const [measurementsRes, alertsRes, projectDoc] = await Promise.all([
            getSessionMeasurements(sessionId),
            getSessionAlerts(sessionId),
            db.collection("projects").doc(sessionData.projectId).get()
        ]);

        const measurements = measurementsRes.data || [];
        const alerts = alertsRes.data || [];
        const projectData = projectDoc.exists ? projectDoc.data() : {};

        // --- Create Workbook ---
        const wb = XLSX.utils.book_new();

        // 1. Summary Sheet
        const summaryData = [
            ["Field", "Value"],
            ["Session ID", sessionData.id],
            ["Project ID", sessionData.projectId],
            ["Created At", sessionData.createdAt],
            ["Updated At", sessionData.updatedAt],
            ["Status", sessionData.status],
            ["Total Time (s)", sessionData.time],
            ["Notes", sessionData.notes || ""],
            ["Measurements Count", measurements.length],
            ["Alerts Count", alerts.length]
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

        // 2. Project Sheet
        if (projectData) {
            const projectRows = [
                ["Field", "Value"],
                ["ID", projectData.id],
                ["Created At", projectData.createdAt],
                ["Updated At", projectData.updatedAt],
                // Project Details
                ["Project Title", projectData.projectDetails?.projectTitle || ""],
                ["Description", projectData.projectDetails?.description || ""],
                ["Type", projectData.projectDetails?.projectType || ""],
                ["Timer", projectData.projectDetails?.timer || ""],
                ["Target", projectData.projectDetails?.target || ""],
                // Session Defaults
                ["Default Interval", projectData.sessionDefaultSettings?.dataAcquisitionInterval || ""],
                ["Default Temp SetPoint", projectData.sessionDefaultSettings?.temperatureSetPoint || ""],
                ["Default pH SetPoint", projectData.sessionDefaultSettings?.phSetPoint || ""],
                // Session Details (Template)
                ["Reactor Name", projectData.sessionDetails?.reactorName || ""],
                ["Sample Name", projectData.sessionDetails?.sampleName || ""],
                ["Culture Medium", projectData.sessionDetails?.cultureMedium || ""],
            ];
            const wsProject = XLSX.utils.aoa_to_sheet(projectRows);
            XLSX.utils.book_append_sheet(wb, wsProject, "Project");
        }

        // 3. Measurements Sheet
        if (measurements.length > 0) {
            // Flatten measurements for Excel
            const flatMeasurements = measurements.map(m => ({
                Timestamp: m.timestamp,
                pH: m.ph,
                Temperature: m.temperature,
                OD: m.od,
                CO2: m.co2,
                ...m // Include any other dynamic keys
            }));
            const wsMeasurements = XLSX.utils.json_to_sheet(flatMeasurements);
            XLSX.utils.book_append_sheet(wb, wsMeasurements, "Measurements");
        }

        // 3. Alerts Sheet
        if (alerts.length > 0) {
            const flatAlerts = alerts.map(a => ({
                ID: a.id,
                Timestamp: a.timestamp,
                Type: a.type,
                Message: a.message,
                Category: a.category,
                SensorType: a.details?.sensorType || "",
                Value: a.details?.value || "",
                Read: a.read
            }));
            const wsAlerts = XLSX.utils.json_to_sheet(flatAlerts);
            XLSX.utils.book_append_sheet(wb, wsAlerts, "Alerts");
        }

        // Generate Buffer
        const buf = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

        return { success: true, data: buf };

    } catch (error) {
        console.error("Error exporting session:", error);
        return { success: false, error: "Failed to export session" };
    }
}
