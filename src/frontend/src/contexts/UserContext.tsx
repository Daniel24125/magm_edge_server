/**
 * UserContext.tsx
 *
 * Responsibilities:
 * - Manages global user state (e.g., User ID | Is User Authenticated | User Data).
 * - Stores the current User configuration.
 *
 * Usage:
 * Wrap the root layout with <UserProvider> and use useUser()
 * in child components to access or update global state.
 */

"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { useRouter } from "next/navigation";
import Loading from "@/components/ui/loading";
import { OfflineLoginDialog } from "@/components/auth/OfflineLoginDialog";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

interface UserContextType {
    user: any;
    isLoading: boolean;
    error: any;
}

const UserContext = createContext<UserContextType | null>(null);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const { user, isLoading: isAuth0Loading, error: auth0Error } = useUser();
    const router = useRouter();
    const isOnline = useNetworkStatus();

    // Offline User State
    const [offlineUser, setOfflineUser] = useState<any>(null);
    const [showOfflineLogin, setShowOfflineLogin] = useState(false);

    useEffect(() => {
        // If Auth0 is loading, wait.
        if (isAuth0Loading) return;

        // If we have an Auth0 user, we are good.
        if (user) return;

        // If no Auth0 user:
        if (isOnline) {
            // Online but not authenticated -> Redirect to login
            // (Unless we want to allow offline user to persist even when online for syncing?)
            // For now, simple logic: Online = Require Auth0.
            router.push('/auth/login');
        } else {
            // Offline -> Check for offline user
            const stored = localStorage.getItem("offline_user");
            if (stored) {
                const parsed = JSON.parse(stored);
                // Mock an Auth0-like user structure
                setOfflineUser({
                    sub: `offline|${parsed.email}`,
                    name: parsed.name,
                    email: parsed.email,
                    isOfflineUser: true
                });
            } else {
                setShowOfflineLogin(true);
            }
        }

    }, [isAuth0Loading, user, router, isOnline]);

    const handleOfflineLogin = (userData: { name: string; email: string }) => {
        setOfflineUser({
            sub: `offline|${userData.email}`,
            name: userData.name,
            email: userData.email,
            isOfflineUser: true
        });
        setShowOfflineLogin(false);
    };

    const finalUser = user || offlineUser;
    // We stop loading if Auth0 is done, AND (we have a user OR we are showing offline login)
    // Actually simplicity: if we are waiting for offline interaction? 
    // Let's just pass `finalUser`.

    if (isAuth0Loading) return <Loading isLoading={true} />

    // Return children but render dialog if needed
    return (
        <UserContext.Provider value={{ user: finalUser, isLoading: isAuth0Loading, error: auth0Error }}>
            {children}
            <OfflineLoginDialog open={showOfflineLogin} onLogin={handleOfflineLogin} />
        </UserContext.Provider>
    );
};

export const useUserContext = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
};