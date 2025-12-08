"use server";

import { auth0 } from "@/lib/auth0";
import { db } from "@/services/firebase";
import { ISession } from "@/types/sessions";
import { revalidatePath } from "next/cache";

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
