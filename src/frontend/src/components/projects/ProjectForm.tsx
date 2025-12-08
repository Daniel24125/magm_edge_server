"use client";

import * as React from "react";
import { useForm, UseFormReturn, Controller, useFieldArray } from "react-hook-form";
import { IProject } from "@/types/projects";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "../ui/field";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "../ui/scroll-area";
import { ProjectFormSummary } from "./ProjectSummary";
import { DurationPicker } from "../ui/duration-picker";

interface ProjectFormProps extends React.HTMLAttributes<HTMLFormElement> {
    defaultValues?: Partial<IProject>;
    onSubmit: (data: any) => void;
    isLoading?: boolean;
}

interface IProjectFormContext extends UseFormReturn<IProject> {
    step: number;
    setStep: React.Dispatch<React.SetStateAction<number>>;
    isLoading?: boolean;
    onSubmit: (data: any) => void;
    isStepValid: boolean;
}

const ProjectFormContext = React.createContext<IProjectFormContext | null>(null);

export function useProjectFormContext() {
    const context = React.useContext(ProjectFormContext);
    if (!context) {
        throw new Error("useProjectFormContext must be used within a ProjectForm");
    }
    return context;
}

export function ProjectForm({ defaultValues, onSubmit, isLoading, className, ...props }: ProjectFormProps) {
    const [step, setStep] = React.useState(0);
    const form = useForm<IProject>({
        defaultValues: defaultValues || {
            projectDetails: {
                projectType: "manual"
            },
            sessionDefaultSettings: {
                dataAcquisitionInterval: 1,
                temperatureSetPoint: 25,
                phSetPoint: 7
            },
            alertConfiguration: [
                { alertType: "temperature", enabled: false, threshold: 0, delay: 0 },
                { alertType: "ph", enabled: false, threshold: 0, delay: 0 },
                { alertType: "OD", enabled: false, threshold: 0, delay: 0 }
            ]
        }
    });

    React.useEffect(() => {
        if (defaultValues) {
            form.reset(defaultValues);
        } else {
            form.reset({
                projectDetails: {
                    projectType: "manual",
                    projectTitle: "",
                    description: "",
                    timer: 0,
                    target: 0
                },
                sessionDetails: {
                    reactorName: "",
                    sampleName: "",
                    cultureMedium: "",
                    co2Pressure: undefined
                },
                sessionDefaultSettings: {
                    dataAcquisitionInterval: 1,
                    temperatureSetPoint: 25,
                    phSetPoint: 7
                },
                alertConfiguration: [
                    { alertType: "temperature", enabled: false, threshold: 0, delay: 0 },
                    { alertType: "ph", enabled: false, threshold: 0, delay: 0 },
                    { alertType: "OD", enabled: false, threshold: 0, delay: 0 }
                ]
            });
        }
    }, [defaultValues, form]);

    const projectTitle = form.watch("projectDetails.projectTitle");
    const projectType = form.watch("projectDetails.projectType");
    const timer = form.watch("projectDetails.timer");
    const target = form.watch("projectDetails.target");
    const alertConfiguration = form.watch("alertConfiguration");

    const isStepValid = React.useMemo(() => {
        if (step === 0) {
            if (!projectTitle) return false;
            if (projectType === "timer" && !timer) return false;
            if (projectType === "target" && !target) return false;
            return true;
        }
        if (step === 3) {
            return alertConfiguration.every(alert => !alert.enabled || (alert.enabled && alert.threshold !== undefined && alert.threshold !== null && alert.threshold.toString() !== ""));
        }
        return true;
    }, [step, projectTitle, projectType, timer, target, alertConfiguration]);

    return (
        <ProjectFormContext.Provider value={{ ...form, step, setStep, isLoading, onSubmit, isStepValid }}>
            <div className="flex justify-between gap-2">
                <StepManager />
                <div className="min-w-60 w-full flex flex-col items-center gap-2 px-4">
                    <h5 className="font-bold text-lg">{step < 4 ? "Project Registration" : "Project Summary"}</h5>
                    {step < 4 && <p className="text-text-faded text-xs text-center max-w-72 mb-7">Projects are containers where you can store default session configurations and experimental details</p>}
                    <ProjectFormContent className={className} {...props} />
                </div>
            </div>
        </ProjectFormContext.Provider>
    );
}

const Step = ({ step }: { step: { id: number; name: string } }) => {
    const { setStep, step: currentStep, isStepValid } = useProjectFormContext();
    const handleStepClick = () => {
        if (!isStepValid) {
            toast.error("Please fill in all required fields", {
                duration: 5000,

            })
            return;
        }
        setStep(step.id)
    }
    return (
        <div onClick={handleStepClick} className="flex flex-col gap-2 cursor-pointer hover:text-primary">
            <p className="text-text-faded text-sm">{`STEP ${step.id + 1}`}</p>
            <span className={`text-sm font-medium ${step.id === currentStep ? "text-primary" : ""}`}>{step.name}</span>
        </div>
    );
};

const StepManager = () => {
    const steps = React.useMemo(() => [
        { id: 0, name: "Project Details" },
        { id: 1, name: "Session Details" },
        { id: 2, name: "Session Default Settings" },
        { id: 3, name: "Alert Configuration" },
        { id: 4, name: "Summary" }
    ], []);


    return (
        <div className="flex flex-col gap-4 bg-sidebar-background w-3xs h-full rounded-lg px-4 py-8 shrink-0">
            {steps.map((step) => (
                <Step key={step.id} step={step} />
            ))}

        </div>
    )
}



const ProjectFormContent = ({ className, ...props }: React.HTMLAttributes<HTMLFormElement>) => {
    const { handleSubmit, isLoading, onSubmit, step, setStep, isStepValid } = useProjectFormContext();


    return (
        <form onSubmit={handleSubmit(onSubmit)} className={cn("grid items-start gap-4 w-full", className)} {...props}>
            <ScrollArea className="w-full max-h-96 h-full">
                {step === 0 && <ProjectDetailsForm />}
                {step === 1 && <SessionDetailsForm />}
                {step === 2 && <SessionDefaultSettingsForm />}
                {step === 3 && <AlertConfigurationForm />}
                {step === 4 && <ProjectFormSummary />}
            </ScrollArea>
            {step === 4 && <Button className="w-full" type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Project"}
            </Button>}
            {step < 4 && <Button className="w-full" type="button" onClick={() => setStep(step + 1)} disabled={isLoading || !isStepValid}>
                Continue
            </Button>}
        </form>

    );
}

const ProjectDetailsForm = () => {
    const { register, control, watch } = useProjectFormContext();
    const projectType = watch("projectDetails.projectType");

    return <FieldSet>
        <FieldGroup>
            <Field>
                <FieldLabel htmlFor="projectTitle">Project Title*</FieldLabel>
                <Input {...register("projectDetails.projectTitle", { required: true })} placeholder="Type your project title here" />
            </Field>
            <Field>
                <FieldLabel htmlFor="projectType">Project Type</FieldLabel>
                <Controller
                    control={control}
                    name="projectDetails.projectType"
                    defaultValue="manual"
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger>
                                <SelectValue placeholder="Project Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="manual">Manual</SelectItem>
                                <SelectItem value="timer">Timer</SelectItem>
                                <SelectItem value="target">Target</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
            </Field>
            {projectType === "timer" && (
                <Field>
                    <FieldLabel htmlFor="timer">Timer (Duration)*</FieldLabel>
                    <Controller
                        control={control}
                        name="projectDetails.timer"
                        defaultValue={0}
                        rules={{ required: true, min: 1 }}
                        render={({ field }) => (
                            <DurationPicker
                                value={field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </Field>
            )}
            {projectType === "target" && (
                <Field>
                    <FieldLabel htmlFor="target">OD Target Value*</FieldLabel>
                    <Input {...register("projectDetails.target", { required: true })} placeholder="Enter the OD target value" type="number" />
                </Field>
            )}
            <Field>
                <Textarea className="resize-none" {...register("projectDetails.description")} placeholder="Description" />
            </Field>
        </FieldGroup>
    </FieldSet>
}


const SessionDetailsForm = () => {
    const { register } = useProjectFormContext();


    return <FieldSet>
        <FieldGroup>
            <Field>
                <Input {...register("sessionDetails.reactorName")} placeholder="Reactor Name" />
            </Field>
            <Field>
                <Input {...register("sessionDetails.sampleName")} placeholder="Sample Name" />
            </Field>
            <Field>
                <Input {...register("sessionDetails.cultureMedium")} placeholder="Culture Medium" />
            </Field>
            <Field>
                <Input {...register("sessionDetails.co2Pressure")} placeholder="CO2 Pressure" />
            </Field>

        </FieldGroup>
    </FieldSet>
}


const SessionDefaultSettingsForm = () => {
    const { register } = useProjectFormContext();

    return <FieldSet>
        <FieldGroup>
            <Field>
                <FieldLabel htmlFor="dataAcquisitionInterval">Data Acquisition Interval (minutes)</FieldLabel>
                <Input {...register("sessionDefaultSettings.dataAcquisitionInterval")} placeholder="Data Acquisition Interval" type="number" min={1} max={120} />
                <FieldDescription>The data aquisition interval defines how often the data is collected from the reactor. (Min: 1, Max: 120)</FieldDescription>
            </Field>
            <Field>
                <FieldLabel htmlFor="temperatureSetPoint">Expected Temperature</FieldLabel>
                <Input {...register("sessionDefaultSettings.temperatureSetPoint")} placeholder="Temperature Set Point" />
            </Field>
            <Field>
                <FieldLabel htmlFor="phSetPoint">PH Set Point</FieldLabel>
                <Input {...register("sessionDefaultSettings.phSetPoint")} placeholder="PH Set Point" />
            </Field>
        </FieldGroup>
    </FieldSet>
}


const AlertConfigurationForm = () => {
    const { control } = useProjectFormContext();
    const { fields } = useFieldArray({
        control,
        name: "alertConfiguration"
    });

    return <FieldSet>
        <FieldGroup>
            {fields.map((field, index) => {
                return (
                    <AlertItem key={field.id} index={index} />
                )
            })}
        </FieldGroup>
    </FieldSet>
}

const AlertItem = ({ index }: { index: number }) => {
    const { register, control, watch } = useProjectFormContext();
    const enabled = watch(`alertConfiguration.${index}.enabled`);
    const alertType = watch(`alertConfiguration.${index}.alertType`);

    const label = alertType === "temperature" ? "Temperature Alert" : alertType === "ph" ? "pH Alert" : "OD Alert";

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <FieldLabel className="text-sm font-medium">{label}</FieldLabel>
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
                <CollapsibleContent className="data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp overflow-hidden">
                    <div className="flex gap-2 pt-2">
                        <Field>
                            <FieldLabel>Threshold</FieldLabel>
                            <Input
                                {...register(`alertConfiguration.${index}.threshold`, { required: enabled })}
                                placeholder="Threshold"
                                className="w-full"
                            />
                        </Field>
                        <Field>
                            <FieldLabel>Delay (min)</FieldLabel>
                            <Input
                                {...register(`alertConfiguration.${index}.delay`)}
                                placeholder="Delay (min)"
                                className="w-full"
                            />
                        </Field>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    )
}
