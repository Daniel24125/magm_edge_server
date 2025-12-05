import { clsx, type ClassValue } from "clsx"
import { Hand, LucideProps, Target, Timer } from "lucide-react";
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
        description: "Timer projects allow you to define the stoppng time of the experiment."
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

export const formatDuration = (seconds: number | undefined) => {
  if (!seconds) return "00:00:00"
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${pad(days)}:${pad(hours)}:${pad(minutes)}`
}
