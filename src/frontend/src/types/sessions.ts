import { TAlert } from ".";
import { TSessionDetails, TSessionDefaultSettings, TAlertConfiguration } from "./projects";

export type TMeasurement = {
    timestamp: string;
    temperature?: number;
    ph?: number;
    od?: number;
    co2?: number;
}

export interface ISession {
    id: string;
    userId: string;
    projectId: string;
    createdAt: string;
    updatedAt: string;
    status: 'running' | 'paused' | 'completed' | 'failed';
    notes?: string;
    time?: number; // Duration in seconds
    duration?: number; // Duration in seconds for the Timer Projects
    target?: number; // Target value for the Target Projects
    sessionDetails: TSessionDetails;
    settings: TSessionDefaultSettings;
    alertConfiguration: TAlertConfiguration[];
    measurements: TMeasurement[];
    alerts?: TAlert[];
}
