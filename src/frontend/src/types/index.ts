// --- Alert Types ---
export type TAlert = {
    id: string;
    type: "info" | "success" | "warning" | "error";
    message: string;
    timestamp: string;
    details?: any;
};

// --- Device Types ---
export type TDeviceStatus = "ONLINE" | "OFFLINE";

export interface ISensorReading {
    value: number;
    unit?: string;
    timestamp: string;
    status?: string;
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
