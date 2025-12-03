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

interface UserContextType {
    user: any;
    isLoading: boolean;
    error: any;
}

const UserContext = createContext<UserContextType | null>(null);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const { user, isLoading, error } = useUser();
    const [userState, setUserState] = useState<any>(user);
    const [isLoadingState, setIsLoadingState] = useState<boolean>(true);
    const router = useRouter();

    useEffect(() => {
        setUserState(user);
        setIsLoadingState(isLoading);
    }, [user, isLoading]);

    useEffect(() => {
        if (isLoading) return;
        if (!user) router.push('/auth/login');
    }, [isLoading, user]);

    if (isLoadingState || !user) return <div>Loading...</div>;
    if (error) return <div>Error: {(error as Error).message}</div>;
    return (
        <UserContext.Provider value={{ user: userState, isLoading: isLoadingState, error }}>
            {children}
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