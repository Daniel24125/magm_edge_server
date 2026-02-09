"use server";

import { getEffectiveSession } from "@/lib/session"; // Uses local mock if offline
import db from "@/lib/db";
import { IProject } from "@/types/projects";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from 'uuid';

export async function getProjects(): Promise<{ success: boolean; data?: IProject[]; error?: string }> {
    try {
        const session = await getEffectiveSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const userId = session.user.sub;

        const stmt = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC');
        const rows = stmt.all(userId) as any[];

        const projects: IProject[] = rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            projectDetails: row.project_details ? JSON.parse(row.project_details) : undefined,
            sessionDetails: row.session_details ? JSON.parse(row.session_details) : undefined,
            sessionDefaultSettings: row.session_default_settings ? JSON.parse(row.session_default_settings) : undefined,
            sessions: [],
            alertConfiguration: []
        }));

        return { success: true, data: projects };
    } catch (error) {
        console.error("Error fetching projects:", error);
        return { success: false, error: "Failed to fetch projects" };
    }
}

export async function getProject(id: string): Promise<{ success: boolean; data?: IProject; error?: string }> {
    try {
        const session = await getEffectiveSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
        const row = stmt.get(id) as any;

        if (!row) {
            return { success: false, error: "Project not found" };
        }

        if (row.user_id !== session.user.sub) {
            return { success: false, error: "Unauthorized" };
        }

        const project: IProject = {
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            projectDetails: row.project_details ? JSON.parse(row.project_details) : undefined,
            sessionDetails: row.session_details ? JSON.parse(row.session_details) : undefined,
            sessionDefaultSettings: row.session_default_settings ? JSON.parse(row.session_default_settings) : undefined,
            sessions: [],
            alertConfiguration: []
        };

        return { success: true, data: project };
    } catch (error) {
        console.error("Error fetching project:", error);
        return { success: false, error: "Failed to fetch project" };
    }
}

export async function createProject(projectData: Omit<IProject, "id" | "createdAt" | "updatedAt">): Promise<{ success: boolean; data?: IProject; error?: string }> {
    try {
        const session = await getEffectiveSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const now = new Date().toISOString();
        const id = uuidv4();
        const userId = session.user.sub;

        const stmt = db.prepare(`
            INSERT INTO projects (
                id, user_id, created_at, updated_at, 
                project_details, session_details, session_default_settings, synced
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        `);

        stmt.run(
            id,
            userId,
            now,
            now,
            JSON.stringify(projectData.projectDetails),
            JSON.stringify(projectData.sessionDetails),
            JSON.stringify(projectData.sessionDefaultSettings)
        );

        const createdProject: IProject = {
            id,
            createdAt: now,
            updatedAt: now,
            ...projectData
        };

        revalidatePath("/");
        return { success: true, data: createdProject };
    } catch (error) {
        console.error("Error creating project:", error);
        return { success: false, error: "Failed to create project" };
    }
}

export async function updateProject(id: string, projectData: Partial<IProject>): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getEffectiveSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // Verify ownership first
        const checkStmt = db.prepare('SELECT user_id FROM projects WHERE id = ?');
        const row = checkStmt.get(id) as any;

        if (!row) return { success: false, error: "Project not found" };
        if (row.user_id !== session.user.sub) return { success: false, error: "Unauthorized" };

        const now = new Date().toISOString();

        // Dynamic update query construction
        const updates: string[] = ["updated_at = ?, synced = 0"];
        const values: any[] = [now];

        if (projectData.projectDetails) {
            updates.push("project_details = ?");
            values.push(JSON.stringify(projectData.projectDetails));
        }
        if (projectData.sessionDetails) {
            updates.push("session_details = ?");
            values.push(JSON.stringify(projectData.sessionDetails));
        }
        if (projectData.sessionDefaultSettings) {
            updates.push("session_default_settings = ?");
            values.push(JSON.stringify(projectData.sessionDefaultSettings));
        }

        values.push(id);

        const updateStmt = db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`);
        updateStmt.run(...values);

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Error updating project:", error);
        return { success: false, error: "Failed to update project" };
    }
}

export async function deleteProject(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getEffectiveSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const checkStmt = db.prepare('SELECT user_id FROM projects WHERE id = ?');
        const row = checkStmt.get(id) as any;

        if (!row) return { success: false, error: "Project not found" };
        if (row.user_id !== session.user.sub) return { success: false, error: "Unauthorized" };

        const deleteStmt = db.prepare('DELETE FROM projects WHERE id = ?');
        deleteStmt.run(id);

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Error deleting project:", error);
        return { success: false, error: "Failed to delete project" };
    }
}
