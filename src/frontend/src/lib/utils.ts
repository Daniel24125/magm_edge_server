import { ChartConfig } from "@/components/ui/chart";
import { TMeasurementType } from "@/types/projects";
import { clsx, type ClassValue } from "clsx"
import { Drone, Hand, LucideProps, Target, TestTube, Thermometer, Timer, Wind } from "lucide-react";
import { ForwardRefExoticComponent, RefAttributes } from "react";
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type TProjectTypeProperties = {
  title: string;
  color: string;
  icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
  description: string;
}

export const getProjectTypeProperties = (projectType: "manual" | "timer" | "target"): TProjectTypeProperties => {
  switch (projectType) {
    case "manual":
      return {
        title: "Manual Project",
        color: "#8462D1",
        icon: Hand,
        description: "Manual projects require you to manually stop the session"
      };
    case "timer":
      return {
        title: "Timer Project",
        color: "#004CCE",
        icon: Timer,
        description: "Timer projects allow you to define the stopping time of the experiment."
      };
    case "target":
      return {
        title: "Target Project",
        color: "#E14942",
        icon: Target,
        description: "Target projects allow you to automatically stop an experiment when the OD reaches a certain limit."
      };

  }
}

export const formatDate = (date: Date | string | number) => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export const formatDuration = (seconds: number | undefined) => {
  if (!seconds) return "00:00:00:00"
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds % 60)}`
}

export const getFormartedTimeWithLetters = (seconds: number | undefined) => {
  if (!seconds) return "00d 00h 00m 00s"

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(remainingSeconds)}s`
}

export const getAlertIcon = (alertType: TMeasurementType) => {
  switch (alertType) {
    case "temperature":
      return {
        icon: Thermometer,
        color: "#F42E25",
        label: "Temperature",
        units: "°C"
      };
    case "ph":
      return {
        icon: TestTube,
        color: "#8462D1",
        label: "pH",
        units: ""
      };
    case "od":
      return {
        icon: Drone,
        color: "#004CCE",
        label: "OD",
        units: ""
      };
    case "co2":
      return {
        icon: Wind,
        color: "#E1A325",
        label: "CO2",
        units: "mmol/L"
      };
  }
}

export const configEnv = {
  ph: {
    label: "pH",
    color: "#8462D1",
  },
  temperature: {
    label: "Temp (°C)",
    color: "#F42E25",
  },
} satisfies ChartConfig

export const configGrowth = {
  od: {
    label: "OD",
    color: "#004CCE",
  },
  co2: {
    label: "CO2 (%)",
    color: "#E1A325",
  },
} satisfies ChartConfig











