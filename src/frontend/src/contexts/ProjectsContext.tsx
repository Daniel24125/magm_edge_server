/**
 * ProjectsContext.tsx
 *
 * Responsibilities:
 * - Exposes a global Projects state (e.g., Projects list, selected project, etc.).
 * - Manages CRUD operations via Server Actions.
 * 
 * Usage:
 * Wrap the root layout with <ProjectsProvider> and use useProjects()
 * in child components to access or update global state.
 */
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { IProject } from "@/types/projects";
import { ISession } from "@/types/sessions";
import { getProjects, createProject, updateProject, deleteProject } from "@/app/actions/projects";
import { getSessions } from "@/app/actions/sessions";
import { toast } from "sonner";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import Loading from "@/components/ui/loading";

interface ProjectsContextType {
    projects: IProject[];
    isLoading: boolean;
    error: string | null;
    addProject: (data: Omit<IProject, "id" | "createdAt" | "updatedAt">) => Promise<void>;
    editProject: (id: string, data: Partial<IProject>) => Promise<void>;
    removeProject: (id: string) => Promise<void>;
    refreshProjects: () => Promise<void>;
    open: boolean;
    setOpen: (open: boolean) => void;
    mode: 'create' | 'edit';
    setMode: (mode: 'create' | 'edit') => void;
    selectedProject: IProject | null;
    setSelectedProject: (project: IProject | null) => void;
    getLastSession: () => Promise<ISession | null>;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

export const ProjectsProvider = ({ children }: { children: React.ReactNode }) => {
    const [projects, setProjects] = useState<IProject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<'create' | 'edit'>('create');
    const [selectedProject, setSelectedProject] = useState<IProject | null>(null);


    const handleSubmit = async (data: IProject) => {
        setIsLoading(true);
        try {
            if (mode === 'create') {
                await addProject(data);
            } else {
                await editProject(selectedProject!.id, data);
            }
            setOpen(false);
            setSelectedProject(null);
            setMode('create');
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };
    const refreshProjects = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getProjects();
            if (result.success && result.data) {
                setProjects(result.data);
                setError(null);
            } else {
                setError(result.error || "Failed to fetch projects");
                toast.error(result.error || "Failed to fetch projects");
            }
        } catch (err) {
            console.error(err);
            setError("An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        refreshProjects();
    }, [refreshProjects]);

    const addProject = useCallback(async (data: Omit<IProject, "id" | "createdAt" | "updatedAt">) => {
        try {
            const result = await createProject(data);
            if (result.success && result.data) {
                setProjects(prev => [...prev, result.data!]);
                toast.success("Project created successfully");
            } else {
                toast.error(result.error || "Failed to create project");
                throw new Error(result.error);
            }
        } catch (err) {
            console.error(err);
            toast.error("An unexpected error occurred");
            throw err;
        }
    }, []);

    const editProject = useCallback(async (id: string, data: Partial<IProject>) => {
        try {
            // Optimistic update
            setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data } as IProject : p));

            const result = await updateProject(id, data);
            if (result.success) {
                toast.success("Project updated successfully");
                // Optionally refresh to get strict server state
                // refreshProjects(); 
            } else {
                toast.error(result.error || "Failed to update project");
                // Revert on failure
                refreshProjects();
                throw new Error(result.error);
            }
        } catch (err) {
            console.error(err);
            toast.error("An unexpected error occurred");
            refreshProjects(); // Revert
            throw err;
        }
    }, [refreshProjects]);

    const removeProject = useCallback(async (id: string) => {
        try {
            // Optimistic update
            setProjects(prev => prev.filter(p => p.id !== id));

            const result = await deleteProject(id);
            if (result.success) {
                toast.success("Project deleted successfully");
            } else {
                toast.error(result.error || "Failed to delete project");
                refreshProjects(); // Revert
                throw new Error(result.error);
            }
        } catch (err) {
            console.error(err);
            toast.error("An unexpected error occurred");
            refreshProjects(); // Revert
            throw err;
        }
    }, [refreshProjects]);

    const getLastSession = useCallback(async () => {
        try {
            const result = await getSessions();
            if (result.success && result.data && result.data.length > 0) {
                // Sort by createdAt descending
                const sorted = result.data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                return sorted[0];
            }
            return null;
        } catch (error) {
            console.error("Failed to get last session", error);
            return null;
        }
    }, []);

    return (
        <ProjectsContext.Provider value={{ projects, isLoading, error, addProject, editProject, removeProject, refreshProjects, open, setOpen, mode, setMode, selectedProject, setSelectedProject, getLastSession }}>
            <Loading isLoading={isLoading} />
            {children}
            <ProjectDialog open={open} setOpen={setOpen} onSubmit={handleSubmit} defaultValues={selectedProject || undefined} mode={mode} />
        </ProjectsContext.Provider>
    );
};

export const useProjects = () => {
    const context = useContext(ProjectsContext);
    if (!context) {
        throw new Error("useProjects must be used within a ProjectsProvider");
    }
    return context;
};
