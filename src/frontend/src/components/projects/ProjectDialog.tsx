"use client";

import * as React from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import { ProjectForm } from "./ProjectForm";
import { IProject } from "@/types/projects";

interface ProjectDialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    onSubmit: (data: IProject) => Promise<void>;
    defaultValues?: Partial<IProject>;
    mode?: "create" | "edit";
}

export function ProjectDialog({ open, setOpen, onSubmit, defaultValues, mode = "create" }: ProjectDialogProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const [isLoading, setIsLoading] = React.useState(false);

    const handleSubmit = async (data: IProject) => {
        setIsLoading(true);
        try {
            await onSubmit(data);
            setOpen(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <ProjectForm onSubmit={handleSubmit} defaultValues={defaultValues} isLoading={isLoading} />
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent>
                <DrawerHeader className="text-left">
                    <DrawerTitle>{mode === "create" ? "Create Project" : "Edit Project"}</DrawerTitle>
                    <DrawerDescription>
                        {mode === "create" ? "Add a new project to your workspace." : "Make changes to your project."}
                    </DrawerDescription>
                </DrawerHeader>
                <div className="px-4">
                    <ProjectForm className="px-4" onSubmit={handleSubmit} defaultValues={defaultValues} isLoading={isLoading} />
                </div>
                <DrawerFooter className="pt-2">
                    <DrawerClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
