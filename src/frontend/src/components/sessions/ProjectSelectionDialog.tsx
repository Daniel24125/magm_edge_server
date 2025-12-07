"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useProjects } from "@/contexts/ProjectsContext";
import { IProject } from "@/types/projects";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface ProjectSelectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (project: IProject) => void;
}

export function ProjectSelectionDialog({ open, onOpenChange, onSelect }: ProjectSelectionDialogProps) {
    const { projects } = useProjects();
    const [searchQuery, setSearchQuery] = useState("");

    const filteredProjects = projects.filter(project =>
        project.projectDetails.projectTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Select Project</DialogTitle>
                    <DialogDescription>
                        Choose a project to start a session for.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative mb-4">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                    />
                </div>

                <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                    <div className="flex flex-col gap-2">
                        {filteredProjects.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No projects found.</p>
                        ) : (
                            filteredProjects.map((project) => (
                                <Button
                                    key={project.id}
                                    variant="ghost"
                                    className="justify-start h-auto py-3 px-4 flex flex-col items-start gap-1 hover:bg-accent"
                                    onClick={() => onSelect(project)}
                                >
                                    <span className="font-medium">{project.projectDetails.projectTitle}</span>
                                    <span className="text-xs text-muted-foreground">
                                        Type: {project.projectDetails.projectType}
                                    </span>
                                </Button>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
