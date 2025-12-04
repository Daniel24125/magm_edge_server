"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { IProject, TProjectDetails, TSessionDetails, TSessionDefaultSettings } from "@/types/projects";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProjectFormProps extends React.HTMLAttributes<HTMLFormElement> {
    defaultValues?: Partial<IProject>;
    onSubmit: (data: any) => void;
    isLoading?: boolean;
}

export function ProjectForm({ defaultValues, onSubmit, isLoading, className, ...props }: ProjectFormProps) {
    const { register, handleSubmit, formState: { errors } } = useForm<IProject>({
        defaultValues: defaultValues || {
            projectDetails: {
                projectType: "manual"
            },
            sessionDefaultSettings: {
                dataAcquisitionInterval: 60,
                temperatureSetPoint: 25,
                phSetPoint: 7
            },
            alertConfiguration: []
        }
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className={cn("grid items-start gap-4", className)} {...props}>
            <div className="grid gap-2">
                <h3 className="font-medium">Project Details</h3>
                <div className="grid gap-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="projectTitle">
                        Title
                    </label>
                    <input
                        id="projectTitle"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...register("projectDetails.projectTitle", { required: true })}
                    />
                    {errors.projectDetails?.projectTitle && <span className="text-red-500 text-xs">Required</span>}
                </div>

                <div className="grid gap-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="description">
                        Description
                    </label>
                    <textarea
                        id="description"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...register("projectDetails.description")}
                    />
                </div>

                <div className="grid gap-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="projectType">
                        Type
                    </label>
                    <select
                        id="projectType"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...register("projectDetails.projectType")}
                    >
                        <option value="manual">Manual</option>
                        <option value="timer">Timer</option>
                        <option value="target">Target</option>
                    </select>
                </div>
            </div>

            <div className="grid gap-2">
                <h3 className="font-medium">Default Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium leading-none" htmlFor="tempSetPoint">Temp Set Point (°C)</label>
                        <input
                            id="tempSetPoint"
                            type="number"
                            step="0.1"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            {...register("sessionDefaultSettings.temperatureSetPoint", { valueAsNumber: true })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium leading-none" htmlFor="phSetPoint">pH Set Point</label>
                        <input
                            id="phSetPoint"
                            type="number"
                            step="0.1"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            {...register("sessionDefaultSettings.phSetPoint", { valueAsNumber: true })}
                        />
                    </div>
                </div>
            </div>

            <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Project"}
            </Button>
        </form>
    );
}
