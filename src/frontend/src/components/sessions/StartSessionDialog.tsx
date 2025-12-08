"use client";

import React from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TSessionDefaultSettings, TAlertConfiguration } from "@/types/projects";

interface StartSessionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialSettings: TSessionDefaultSettings;
    initialAlerts: TAlertConfiguration[];
    onConfirm: (data: StartSessionFormData) => void;
    isLoading?: boolean;
}

export interface StartSessionFormData {
    settings: TSessionDefaultSettings;
    alertConfiguration: TAlertConfiguration[];
    notes?: string;
}

export function StartSessionDialog({ open, onOpenChange, initialSettings, initialAlerts, onConfirm, isLoading }: StartSessionDialogProps) {
    const { register, control, handleSubmit, watch, reset } = useForm<StartSessionFormData>({
        defaultValues: {
            settings: initialSettings,
            alertConfiguration: initialAlerts,
            notes: ""
        }
    });

    // Reset form when opening with new initial values
    React.useEffect(() => {
        if (open) {
            reset({
                settings: initialSettings,
                alertConfiguration: initialAlerts,
                notes: ""
            });
        }
    }, [open, initialSettings, initialAlerts, reset]);

    const onSubmit = (data: StartSessionFormData) => {
        onConfirm(data);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl  flex flex-col max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Start Session</DialogTitle>
                    <DialogDescription>
                        Review and modify session settings before starting.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 w-full pr-4  ">
                    <form id="start-session-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 py-4">

                        {/* Notes Section */}
                        <div className="space-y-2">
                            <h3 className="font-medium text-sm text-muted-foreground">Session Notes</h3>
                            <Textarea
                                {...register("notes")}
                                placeholder="Add any notes for this session..."
                                className="resize-none"
                            />
                        </div>

                        {/* Default Settings Section */}
                        <div className="space-y-4">
                            <h3 className="font-medium text-sm text-muted-foreground">Default Settings</h3>
                            <FieldSet>
                                <FieldGroup>
                                    <Field>
                                        <FieldLabel htmlFor="settings.dataAcquisitionInterval">Data Acquisition Interval (minutes)</FieldLabel>
                                        <Input
                                            {...register("settings.dataAcquisitionInterval", { valueAsNumber: true, min: 1, max: 120 })}
                                            type="number"
                                            placeholder="Interval"
                                        />
                                        <FieldDescription>Min: 1, Max: 120 minutes</FieldDescription>
                                    </Field>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field>
                                            <FieldLabel htmlFor="settings.temperatureSetPoint">Temperature Set Point (°C)</FieldLabel>
                                            <Input
                                                {...register("settings.temperatureSetPoint", { valueAsNumber: true })}
                                                type="number"
                                                placeholder="Temperature"
                                            />
                                        </Field>
                                        <Field>
                                            <FieldLabel htmlFor="settings.phSetPoint">pH Set Point</FieldLabel>
                                            <Input
                                                {...register("settings.phSetPoint", { valueAsNumber: true })}
                                                type="number"
                                                step="0.1"
                                                placeholder="pH"
                                            />
                                        </Field>
                                    </div>
                                </FieldGroup>
                            </FieldSet>
                        </div>

                        {/* Alerts Section */}
                        <div className="space-y-4">
                            <h3 className="font-medium text-sm text-muted-foreground">Alert Configuration</h3>
                            <AlertConfigurationList control={control} register={register} watch={watch} />
                        </div>

                    </form>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button type="submit" form="start-session-form" disabled={isLoading}>
                        {isLoading ? "Starting..." : "Start Session"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const AlertConfigurationList = ({ control, register, watch }: any) => {
    const { fields } = useFieldArray({
        control,
        name: "alertConfiguration"
    });

    return (
        <div className="flex flex-col gap-4">
            {fields.map((field, index) => (
                <AlertItem key={field.id} index={index} control={control} register={register} watch={watch} />
            ))}
        </div>
    );
};

const AlertItem = ({ index, control, register, watch }: any) => {
    const enabled = watch(`alertConfiguration.${index}.enabled`);
    const alertType = watch(`alertConfiguration.${index}.alertType`);
    const label = alertType === "temperature" ? "Temperature Alert" : alertType === "ph" ? "pH Alert" : "OD Alert";

    return (
        <div className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{label}</span>
                <Controller
                    control={control}
                    name={`alertConfiguration.${index}.enabled`}
                    render={({ field }) => (
                        <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                    )}
                />
            </div>
            <Collapsible open={enabled}>
                <CollapsibleContent className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium">Threshold</label>
                            <Input
                                {...register(`alertConfiguration.${index}.threshold`, { valueAsNumber: true })}
                                placeholder="Threshold"
                                type="number"
                                step="0.1"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium">Delay (min)</label>
                            <Input
                                {...register(`alertConfiguration.${index}.delay`, { valueAsNumber: true })}
                                placeholder="Delay"
                                type="number"
                            />
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
};
