import { ISession } from "./sessions";

export type TProjectType = "manual" | "timer" | "target"

export type TProjectDetails = {
    projectTitle: string;
    description?: string;
    projectType: "manual" | "timer" | "target";
    timer?: number;
    target?: number;
}

export type TSessionDetails = {
    sessionId?: string;
    reactorName?: string;
    sampleName?: string;
    cultureMedium?: string;
    co2Pressure?: number;
}

export type TSessionDefaultSettings = {
    dataAcquisitionInterval: number;
    temperatureSetPoint: number;
    phSetPoint: number;
}

export type TAlertType = "temperature" | "ph" | "OD";

export type TAlertConfiguration = {
    alertType: TAlertType;
    threshold: number;
    delay?: number;
    enabled: boolean;
}

export interface IProject {
    id: string;
    createdAt: string;
    updatedAt: string;
    projectDetails: TProjectDetails;
    sessionDetails: TSessionDetails;
    sessionDefaultSettings: TSessionDefaultSettings;
    alertConfiguration: TAlertConfiguration[];
    sessions: ISession[];
}


export type TSummaryElementProps = {
    title: string;
    value: string;
    icon?: React.ReactNode;
    color?: string;
}
