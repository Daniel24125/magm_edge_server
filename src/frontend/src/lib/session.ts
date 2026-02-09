
import { auth0 } from "@/lib/auth0";

export const OFFLINE_USER_ID = "offline_user";

export async function getEffectiveSession() {
    try {
        const session = await auth0.getSession();
        if (session && session.user) {
            return session;
        }
    } catch (error) {
        console.warn("Auth0 session check failed (likely offline). Falling back to local session.", error);
    }

    // Fallback Mock Session
    // In a real scenario, you might check a secure HTTP-only cookie for a local PIN login
    // For now, we assume if you have access to the device (Edge Server), you are authorized.
    return {
        user: {
            sub: OFFLINE_USER_ID,
            name: "Offline User",
            email: "offline@local",
        }
    };
}
