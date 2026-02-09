"use server";

import { auth0 } from "@/lib/auth0";
import { db } from "@/services/firebase";
import { IProject } from "@/types/projects";
import { revalidatePath } from "next/cache";

const COLLECTION_NAME = "projects";

export async function getProjects(): Promise<{ success: boolean; data?: IProject[]; error?: string }> {
    try {
        const session = await auth0.getSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }
        // Filter by user ID (sub) to ensure data isolation
        // Assuming we store a 'userId' field in the document or check ownership
        // For now, let's assume we filter by a 'userId' field.
        const snapshot = await db.collection(COLLECTION_NAME)
            .where("userId", "==", session.user.sub)
            .get();

        const projects: IProject[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data
            } as IProject;
        });

        return { success: true, data: projects };
    } catch (error) {
        console.error("Error fetching projects:", error);
        return { success: false, error: "Failed to fetch projects" };
    }
}

export async function getProject(id: string): Promise<{ success: boolean; data?: IProject; error?: string }> {
    try {
        const session = await auth0.getSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const docRef = db.collection(COLLECTION_NAME).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return { success: false, error: "Project not found" };
        }

        const data = doc.data();

        if (data?.userId !== session.user.sub) {
            return { success: false, error: "Unauthorized" };
        }

        const project: IProject = {
            id: doc.id,
            ...data
        } as IProject;

        return { success: true, data: project };
    } catch (error) {
        console.error("Error fetching project:", error);
        return { success: false, error: "Failed to fetch project" };
    }
}

export async function createProject(projectData: Omit<IProject, "id" | "createdAt" | "updatedAt">): Promise<{ success: boolean; data?: IProject; error?: string }> {
    try {
        const session = await auth0.getSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const now = new Date().toISOString();
        const newProject = {
            ...projectData,
            userId: session.user.sub, // Associate with user
            createdAt: now,
            updatedAt: now,
        };

        const docRef = await db.collection(COLLECTION_NAME).add(newProject);

        const createdProject: IProject = {
            id: docRef.id,
            ...newProject,
        } as unknown as IProject; // Cast because newProject has userId which isn't in IProject interface explicitly, but that's fine for Firestore

        revalidatePath("/"); // Revalidate relevant paths
        return { success: true, data: createdProject };
    } catch (error) {
        console.error("Error creating project:", error);
        return { success: false, error: "Failed to create project" };
    }
}

export async function updateProject(id: string, projectData: Partial<IProject>): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth0.getSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // Verify ownership
        const docRef = db.collection(COLLECTION_NAME).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return { success: false, error: "Project not found" };
        }

        if (doc.data()?.userId !== session.user.sub) {
            return { success: false, error: "Unauthorized" };
        }

        await docRef.update({
            ...projectData,
            updatedAt: new Date().toISOString(),
        });

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Error updating project:", error);
        return { success: false, error: "Failed to update project" };
    }
}

export async function deleteProject(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth0.getSession();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const docRef = db.collection(COLLECTION_NAME).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return { success: false, error: "Project not found" };
        }

        if (doc.data()?.userId !== session.user.sub) {
            return { success: false, error: "Unauthorized" };
        }

        await docRef.delete();
        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Error deleting project:", error);
        return { success: false, error: "Failed to delete project" };
    }
}
