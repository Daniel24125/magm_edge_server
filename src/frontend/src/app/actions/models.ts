"use server";

import { auth0 } from "@/lib/auth0";
import { db } from "@/services/firebase";
import { revalidatePath } from "next/cache";
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const COLLECTION_NAME = "ml_models";

export interface IMLModel {
    id: string | number;
    auth0_user_id: string;
    compound_name: string;
    algorithm: string;
    metrics: {
        r2: number;
        rmse: number;
    };
    preprocessing?: {
        sg_window?: number;
        sg_poly?: number;
        sg_deriv?: number;
        [key: string]: unknown;
    };
    num_samples?: number;
    is_active: boolean;
    created_at: string;
    [key: string]: unknown;
}

// --- Local Mode Helpers ---

const getDbPath = () => {
    // In dev, we are in src/frontend. DB is in src/edge_server/database/models/sessions.db
    const devPath = path.join(process.cwd(), '..', 'edge_server', 'database', 'models', 'sessions.db');
    if (fs.existsSync(devPath)) return devPath;
    return devPath;
}

const isLocalMode = () => {
    return process.env.NEXT_PUBLIC_IS_KIOSK === "true";
}

async function getUserId() {
    try {
        const session = await auth0.getSession();
        if (session?.user?.sub) return session.user.sub;
    } catch (e) {
        // Auth0 might fail if not configured / offline
    }
    
    // Fallback if local mode or kiosk
    if (isLocalMode()) return "system"; // Matches backend default
    return null;
}

// --- Actions ---

export async function getModels(): Promise<{ success: boolean; data?: IMLModel[]; error?: string }> {
    try {
        const userId = await getUserId();
        
        // If no user and not in local mode, THEN error
        if (!userId && !isLocalMode()) {
            return { success: false, error: "Unauthorized" };
        }

        // If local mode (intended for RPi use), prioritize SQLite
        if (isLocalMode()) {
            const dbPath = getDbPath();
            if (fs.existsSync(dbPath)) {
                try {
                    const localDb = new Database(dbPath, { readonly: true });
                    const rows = localDb.prepare("SELECT * FROM ml_models ORDER BY created_at DESC").all() as any[];
                    localDb.close();

                    const models: IMLModel[] = rows.map(row => {
                        let metrics = { r2: 0, rmse: 0 };
                        if (row.metrics) {
                            try { metrics = JSON.parse(row.metrics); } catch { }
                        }
                        return {
                            id: row.id,
                            auth0_user_id: row.auth0_user_id,
                            compound_name: row.compound_name,
                            algorithm: row.algorithm,
                            metrics,
                            is_active: !!row.is_active,
                            created_at: row.created_at,
                        } as IMLModel;
                    });
                    
                    return { success: true, data: models };
                } catch (dbError) {
                    console.error("Local DB error:", dbError);
                    // Fallback to Firestore if local DB fails but we have connectivity
                }
            }
        }

        // Standard Firestore path
        if (!userId) return { success: false, error: "Unauthorized" };

        const snapshot = await db
            .collection(COLLECTION_NAME)
            .where("auth0_user_id", "==", userId)
            .orderBy("created_at", "desc")
            .get();

        const models: IMLModel[] = snapshot.docs.map(doc => {
            const data = doc.data();
            let metrics = data.metrics;
            if (typeof metrics === "string") {
                try { metrics = JSON.parse(metrics); } catch { metrics = { r2: 0, rmse: 0 }; }
            }
            return {
                id: doc.id,
                ...data,
                metrics,
                is_active: !!data.is_active,
            } as IMLModel;
        });

        return { success: true, data: models };
    } catch (error) {
        console.error("Error fetching models:", error);
        return { success: false, error: "Failed to fetch models" };
    }
}

export async function deployModel(modelId: string | number): Promise<{ success: boolean; error?: string }> {
    try {
        const userId = await getUserId();
        if (!userId && !isLocalMode()) return { success: false, error: "Unauthorized" };

        if (isLocalMode()) {
            const dbPath = getDbPath();
            const localDb = new Database(dbPath);
            
            // Find compound name for the model
            const model = localDb.prepare("SELECT compound_name FROM ml_models WHERE id = ?").get(modelId) as any;
            if (!model) return { success: false, error: "Model not found" };

            // Deactivate all for same compound, activate this one
            const updateBatch = localDb.transaction(() => {
                localDb.prepare("UPDATE ml_models SET is_active = 0 WHERE compound_name = ?").run(model.compound_name);
                localDb.prepare("UPDATE ml_models SET is_active = 1 WHERE id = ?").run(modelId);
            });
            updateBatch();
            localDb.close();

            revalidatePath("/dashboard/models");
            return { success: true };
        }

        // Firestore path
        if (!userId) return { success: false, error: "Unauthorized" };
        const targetRef = db.collection(COLLECTION_NAME).doc(String(modelId));
        const targetDoc = await targetRef.get();

        if (!targetDoc.exists) return { success: false, error: "Model not found" };
        if (targetDoc.data()?.auth0_user_id !== userId) return { success: false, error: "Unauthorized" };

        const compoundName = targetDoc.data()?.compound_name;
        const siblingSnapshot = await db
            .collection(COLLECTION_NAME)
            .where("auth0_user_id", "==", userId)
            .where("compound_name", "==", compoundName)
            .get();

        const batch = db.batch();
        siblingSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, { is_active: doc.id === String(modelId) });
        });
        await batch.commit();

        revalidatePath("/dashboard/models");
        return { success: true };
    } catch (error) {
        console.error("Error deploying model:", error);
        return { success: false, error: "Failed to deploy model" };
    }
}

export async function deleteModel(modelId: string | number): Promise<{ success: boolean; error?: string }> {
    try {
        const userId = await getUserId();
        if (!userId && !isLocalMode()) return { success: false, error: "Unauthorized" };

        if (isLocalMode()) {
            const dbPath = getDbPath();
            const localDb = new Database(dbPath);
            const result = localDb.prepare("DELETE FROM ml_models WHERE id = ?").run(modelId);
            localDb.close();

            if (result.changes > 0) {
                revalidatePath("/dashboard/models");
                return { success: true };
            }
            return { success: false, error: "Model not found" };
        }

        // Firestore path
        if (!userId) return { success: false, error: "Unauthorized" };
        const docRef = db.collection(COLLECTION_NAME).doc(String(modelId));
        const doc = await docRef.get();

        if (!doc.exists) return { success: false, error: "Model not found" };
        if (doc.data()?.auth0_user_id !== userId) return { success: false, error: "Unauthorized" };

        await docRef.delete();
        revalidatePath("/dashboard/models");
        return { success: true };
    } catch (error) {
        console.error("Error deleting model:", error);
        return { success: false, error: "Failed to delete model" };
    }
}
