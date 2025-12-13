// --- Alert Types ---
export type TAlert = {
    id: string;
    type: "info" | "success" | "warning" | "error";
    category: "session" | "app";
    message: string;
    timestamp: string;
    details?: any;
    read?: boolean;
};

// --- Device Types ---
export type TDeviceStatus = "ONLINE" | "OFFLINE";

export interface ISensorReading {
    value: number | string | boolean;
    unit?: string;
    timestamp: string;
    status: string;
}

export interface ISensor {
    key: string;
    type: string;
    name: string;
    unit?: string;
    enabled: boolean;
    sensor_id?: string;
    [key: string]: unknown;
}

export interface IDeviceDetails {
    device_name: string;
    sensors?: ISensor[];
    status: string;
    [key: string]: unknown;
}

// --- Calibration Types ---
export type TCalibrationStatus = "READY" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "IDLE";

// --- Multimedia Resources Types ---
export type TSVGProps = {
    width?: number;
    height?: number;
}

// --- Navigation Types ---
export type TNavigationItem = {
    icon: React.ReactNode,
    label: string,
    href: string,
}
export type TConnectionItem = {
    icon: React.ReactNode,
    label: string,
    isConnected: boolean,
}
