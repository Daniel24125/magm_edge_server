"use server";

import { getEffectiveSession } from "@/lib/session";
import db from "@/lib/db";
import { ISession, TMeasurement } from "@/types/sessions";
import { TAlert } from "@/types";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from 'uuid';

export async function getSessions(projectId?: string): Promise<{ success: boolean; data?: ISession[]; error?: string }> {
    try {
        const session = await getEffectiveSession();
        if (!session?.user) {
            // TODO: Offline Auth fallback
            return { success: false, error: "Unauthorized" };
        }

        let query = 'SELECT * FROM sessions WHERE user_id = ?';
        const params: any[] = [session.user.sub];

        if (projectId) {
            query += ' AND project_id = ?';
            params.push(projectId);
        }

        query += ' ORDER BY start_time DESC';

        const stmt = db.prepare(query);
        const rows = stmt.all(...params) as any[];

        const sessions: ISession[] = rows.map(row => ({
            id: row.id,
            projectId: row.project_id,
            userId: row.user_id,
            createdAt: row.start_time, // Mapping start_time to createdAt as legacy schema implied
            updatedAt: row.end_time || row.start_time,
            startTime: row.start_time,
            endTime: row.end_time,
            status: row.status,
            notes: row.notes,
            duration: row.duration,
            target: row.target,
            time: row.duration, // 'time' often used alias for duration in some views
            sessionDetails: row.session_details ? JSON.parse(row.session_details) : undefined,
            settings: row.settings ? JSON.parse(row.settings) : undefined,
            alertConfiguration: row.alert_configuration ? JSON.parse(row.alert_configuration) : undefined,
            measurements: [] // Lazy load or empty for list
        }));

        return { success: true, data: sessions };
    } catch (error) {
        console.error("Error fetching sessions:", error);
        return { success: false, error: "Failed to fetch sessions" };
    }
}

export async function createSession(sessionData: Omit<ISession, "id" | "createdAt" | "updatedAt" | "userId" | "measurements">): Promise<{ success: boolean; data?: ISession; error?: string }> {
    try {
        const session = await getEffectiveSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const now = new Date().toISOString();
        const id = uuidv4();

        // Ensure defaults
        const newSession = {
            id,
            projectId: sessionData.projectId,
            userId: session.user.sub,
            start_time: now,
            end_time: null,
            status: sessionData.status || 'running',
            session_details: JSON.stringify(sessionData.sessionDetails || {}),
            settings: JSON.stringify(sessionData.settings || {}),
            alert_configuration: JSON.stringify(sessionData.alertConfiguration || []),
            notes: sessionData.notes || '',
            duration: 0,
            target: sessionData.target || 0,
            synced: 0
        };

        const stmt = db.prepare(`
            INSERT INTO sessions (
                id, project_id, user_id, start_time, end_time, status, 
                session_details, settings, alert_configuration, notes, duration, target, synced
            ) VALUES (
                @id, @projectId, @userId, @start_time, @end_time, @status,
                @session_details, @settings, @alert_configuration, @notes, @duration, @target, @synced
            )
        `);

        stmt.run(newSession);

        const createdSession: ISession = {
            id,
            userId: session.user.sub,
            createdAt: now,
            updatedAt: now,
            startTime: now,
            measurements: [],
            ...sessionData
        } as ISession;

        revalidatePath("/projects");
        return { success: true, data: createdSession };
    } catch (error) {
        console.error("Error creating session:", error);
        return { success: false, error: "Failed to create session" };
    }
}

export async function updateSession(id: string, sessionData: Partial<ISession>): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getEffectiveSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const checkStmt = db.prepare('SELECT user_id FROM sessions WHERE id = ?');
        const row = checkStmt.get(id) as any;

        if (!row) return { success: false, error: "Session not found" };
        if (row.user_id !== session.user.sub) return { success: false, error: "Unauthorized" };

        const updates: string[] = ["synced = 0"]; // Always mark unsynced on update
        const values: any[] = [];

        // Map frontend fields to DB columns
        if (sessionData.status) { updates.push("status = ?"); values.push(sessionData.status); }
        if (sessionData.endTime) { updates.push("end_time = ?"); values.push(sessionData.endTime); }
        if (sessionData.notes) { updates.push("notes = ?"); values.push(sessionData.notes); }
        if (sessionData.duration !== undefined) { updates.push("duration = ?"); values.push(sessionData.duration); }

        // JSON fields
        if (sessionData.settings) { updates.push("settings = ?"); values.push(JSON.stringify(sessionData.settings)); }
        if (sessionData.alertConfiguration) { updates.push("alert_configuration = ?"); values.push(JSON.stringify(sessionData.alertConfiguration)); }

        if (values.length === 0) return { success: true }; // Nothing to update

        values.push(id);
        const updateStmt = db.prepare(`UPDATE sessions SET ${updates.join(", ")} WHERE id = ?`);
        updateStmt.run(...values);

        revalidatePath("/projects");
        return { success: true };
    } catch (error) {
        console.error("Error updating session:", error);
        return { success: false, error: "Failed to update session" };
    }
}

export async function deleteSession(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getEffectiveSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const checkStmt = db.prepare('SELECT user_id FROM sessions WHERE id = ?');
        const row = checkStmt.get(id) as any;

        if (!row) return { success: false, error: "Session not found" };
        if (row.user_id !== session.user.sub) return { success: false, error: "Unauthorized" };

        const deleteStmt = db.prepare('DELETE FROM sessions WHERE id = ?');
        deleteStmt.run(id);

        revalidatePath("/projects");
        return { success: true };
    } catch (error) {
        console.error("Error deleting session:", error);
        return { success: false, error: "Failed to delete session" };
    }
}

export async function getSessionMeasurements(sessionId: string): Promise<{ success: boolean; data?: TMeasurement[]; error?: string }> {
    try {
        const session = await getEffectiveSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // Verify session access
        const checkStmt = db.prepare('SELECT user_id FROM sessions WHERE id = ?');
        const row = checkStmt.get(sessionId) as any;
        if (!row) return { success: false, error: "Session not found" };
        if (row.user_id !== session.user.sub) return { success: false, error: "Unauthorized" };

        // Fetch unified measurements
        const stmt = db.prepare(`
            SELECT timestamp, ph, temp, od, co2, status, session_time
            FROM unified_measurements
            WHERE session_id = ?
            ORDER BY timestamp DESC
        `);
        const measRows = stmt.all(sessionId) as any[];

        const measurements: TMeasurement[] = measRows.map(r => ({
            timestamp: r.timestamp,
            ph: r.ph,
            temperature: r.temp,
            od: r.od,
            co2: r.co2,
            status: r.status,
            sessionTime: r.session_time
        } as TMeasurement)); // Cast to TMeasurement, ensures compatibility

        return { success: true, data: measurements };
    } catch (error) {
        console.error("Error fetching measurements:", error);
        return { success: false, error: "Failed to fetch measurements" };
    }
}

export async function getSessionAlerts(sessionId: string): Promise<{ success: boolean; data?: TAlert[]; error?: string }> {
    try {
        const session = await getEffectiveSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const stmt = db.prepare(`
            SELECT id, timestamp, sensor_type, value, message, severity, acknowledged
            FROM alerts
            WHERE session_id = ?
            ORDER BY timestamp DESC
        `);
        const rows = stmt.all(sessionId) as any[];

        const alerts: TAlert[] = rows.map(r => ({
            id: r.id.toString(),
            timestamp: r.timestamp,
            type: r.severity,
            category: 'session',
            message: r.message,
            details: {
                sensorType: r.sensor_type,
                value: r.value
            },
            read: !!r.acknowledged
        }));

        return { success: true, data: alerts };
    } catch (error) {
        console.error("Error fetching alerts:", error);
        return { success: false, error: "Failed to fetch alerts" };
    }
}

export async function exportSessionToExcel(sessionId: string): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
        const session = await getEffectiveSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // Fetch Session
        const sessionStmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
        const sessionRow = sessionStmt.get(sessionId) as any;

        if (!sessionRow) return { success: false, error: "Session not found" };
        if (sessionRow.user_id !== session.user.sub) return { success: false, error: "Unauthorized" };

        const sessionData: ISession = {
            id: sessionRow.id,
            projectId: sessionRow.project_id,
            userId: sessionRow.user_id,
            createdAt: sessionRow.start_time,
            updatedAt: sessionRow.end_time || sessionRow.start_time,
            status: sessionRow.status,
            notes: sessionRow.notes,
            duration: sessionRow.duration,
            time: sessionRow.duration,
            measurements: [],
            // details...
        } as unknown as ISession;

        // Fetch Project
        const projectStmt = db.prepare('SELECT * FROM projects WHERE id = ?');
        const projectRow = projectStmt.get(sessionRow.project_id) as any;
        const projectData = projectRow ? {
            id: projectRow.id,
            projectDetails: projectRow.project_details ? JSON.parse(projectRow.project_details) : {},
            sessionDetails: projectRow.session_details ? JSON.parse(projectRow.session_details) : {},
            sessionDefaultSettings: projectRow.session_default_settings ? JSON.parse(projectRow.session_default_settings) : {}
        } : {};

        // Fetch Measurements & Alerts
        const measRes = await getSessionMeasurements(sessionId);
        const alertsRes = await getSessionAlerts(sessionId);
        const measurements = measRes.data || [];
        const alerts = alertsRes.data || [];

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
            const pd = projectData.projectDetails || {};
            const sd = projectData.sessionDetails || {};
            const sds = projectData.sessionDefaultSettings || {};

            const projectRows = [
                ["Field", "Value"],
                ["ID", projectData.id],
                // Project Details
                ["Project Title", pd.projectTitle || ""],
                ["Description", pd.description || ""],
                ["Type", pd.projectType || ""],
                ["Timer", pd.timer || ""],
                ["Target", pd.target || ""],
                // Session Defaults
                ["Default Interval", sds.dataAcquisitionInterval || ""],
                ["Default Temp SetPoint", sds.temperatureSetPoint || ""],
                ["Default pH SetPoint", sds.phSetPoint || ""],
                // Session Details (Template)
                ["Reactor Name", sd.reactorName || ""],
                ["Sample Name", sd.sampleName || ""],
                ["Culture Medium", sd.cultureMedium || ""],
            ];
            const wsProject = XLSX.utils.aoa_to_sheet(projectRows);
            XLSX.utils.book_append_sheet(wb, wsProject, "Project");
        }

        // 3. Measurements Sheet
        if (measurements.length > 0) {
            const flatMeasurements = measurements.map(m => ({
                Timestamp: m.timestamp,
                pH: m.ph,
                Temperature: m.temperature,
                OD: m.od,
                CO2: m.co2,
                Status: m.status
            }));
            const wsMeasurements = XLSX.utils.json_to_sheet(flatMeasurements);
            XLSX.utils.book_append_sheet(wb, wsMeasurements, "Measurements");
        }

        // 4. Alerts Sheet
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
