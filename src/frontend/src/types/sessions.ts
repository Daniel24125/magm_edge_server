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
    // Snapshot of configuration at the time of session start
    sessionDetails: TSessionDetails;
    settings: TSessionDefaultSettings;
    alertConfiguration: TAlertConfiguration[];
    measurements: TMeasurement[];
}
