'use server'

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { auth0 } from "@/lib/auth0";

// Helper to get DB path
const getDbPath = () => {
    // In dev, we are in src/frontend. DB is in src/edge_server/database/models/sessions.db
    // process.cwd() is usually the root of the nextjs app (src/frontend)
    const devPath = path.join(process.cwd(), '..', 'edge_server', 'database', 'models', 'sessions.db');

    if (fs.existsSync(devPath)) return devPath;

    // Fallback or production path (adjust as needed)
    return devPath;
}

export async function getOfflineSessions(userEmail?: string) {
    const dbPath = getDbPath();
    if (!fs.existsSync(dbPath)) {
        console.error("DB not found at", dbPath);
        return { success: false, error: "Database not found" };
    }

    try {
        const db = new Database(dbPath, { readonly: true });

        // Query for sessions with no project_id or empty project_id
        let query = `
            SELECT id, start_time as createdAt, end_time as updatedAt, 
                   status, notes, duration, user_email 
            FROM sessions 
            WHERE (project_id IS NULL OR project_id = '')
        `;

        const params: any[] = [];
        if (userEmail) {
            query += ` AND user_email = ?`;
            params.push(userEmail);
        }

        query += ` ORDER BY start_time DESC`;

        const stmt = db.prepare(query);
        const rows = stmt.all(...params) as any[];

        db.close();

        // Map to ISession-like structure (partial)
        const sessions = rows.map(row => ({
            id: row.id,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            status: row.status,
            notes: row.notes,
            duration: row.duration,
            userEmail: row.user_email,
            // Add placeholders for required ISession fields
            projectId: "",
            userId: "offline",
            sessionDetails: {},
            settings: {},
            alertConfiguration: [],
            measurements: []
        }));

        return { success: true, data: sessions };

    } catch (error) {
        console.error("Error fetching offline sessions:", error);
        return { success: false, error: "Failed to fetch offline sessions" };
    }
}

export async function assignProjectToSession(sessionId: string, projectId: string) {
    const dbPath = getDbPath();
    try {
        const authSession = await auth0.getSession();
        if (!authSession?.user?.sub) {
            return { success: false, error: "Unauthorized" };
        }

        const db = new Database(dbPath);

        const stmt = db.prepare("UPDATE sessions SET project_id = ?, user_id = ?, synced = 0, is_offline = 0 WHERE id = ?");
        const result = stmt.run(projectId, authSession.user.sub, sessionId);

        db.close();

        if (result.changes > 0) {
            return { success: true };
        } else {
            return { success: false, error: "Session not found" };
        }
    } catch (error) {
        console.error("Error assigning project:", error);
        return { success: false, error: "Database error" };
    }
}
