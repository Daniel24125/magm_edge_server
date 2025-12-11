import { ChartConfig } from "@/components/ui/chart";
import { TAlertType } from "@/types/projects";
import { clsx, type ClassValue } from "clsx"
import { Drone, Hand, LucideProps, Target, TestTube, Thermometer, Timer } from "lucide-react";
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
  if (!seconds) return "00:00:00"
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${pad(days)}:${pad(hours)}:${pad(minutes)}`
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

export const getAlertIcon = (alertType: TAlertType) => {
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
    case "OD":
      return {
        icon: Drone,
        color: "#004CCE",
        label: "OD",
        units: ""
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
    color: "#E14942",
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













// <h1 className="text-2xl font-bold mb-2">AWS IoT Live Data & Control Panel</h1>


//       {/* Command Buttons */}
//       <div className="flex gap-4 mt-4">
//         <button
//           onClick={() => sendCommand("start_session", {
//             user: "auth|09875407429'20842",
//             project_id: "WNDRIKGnwkerfnwe32324",
//             notes: "This is a note"
//           })}
//           className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
//         >
//           ▶ Start Measurement
//         </button>
//         <button
//           onClick={() => sendCommand("stop_session")}
//           className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
//         >
//           ⏹ Shutdown
//         </button>
//         <Calibration
//           connection={connection}
//           calibrationStatus={calibrationStatus}
//           calibrationData={calibrationData}
//           liveReading={liveReading}
//           setCalibrationStatus={setCalibrationStatus}
//         />
//       </div>
//       <section className="mt-4">

//         <h2 className="font-semibold text-lg">Connected Devices</h2>
//         <ul className="space-y-1 mt-2">
//           {Object.entries(onlineDevices).map(([id, online]) => (
//             <li key={id} className="text-sm flex items-center gap-2">
//               <span className={`h-2 w-2 rounded-full ${online ? "bg-green-500" : "bg-red-500"}`}></span>
//               <span>{id}</span>
//             </li>
//           ))}
//         </ul>
//       </section>

//       {/* Active Alerts */}
//       <section>
//         <h2 className="text-xl font-semibold mt-6 mb-2 text-red-600">⚠️ Active Alerts</h2>
//         {alerts.length === 0 ? (
//           <p className="text-gray-500 italic">No active alerts.</p>
//         ) : (
//           <ul className="space-y-2">
//             {alerts.map((alert, i) => (
//               <li key={i} className="border border-red-200 p-3 rounded bg-red-50 flex flex-col gap-1">
//                 <div className="flex justify-between items-start">
//                   <span className="font-bold text-red-700">{alert.details.sensor_type} Anomaly</span>
//                   <span className="text-xs text-gray-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
//                 </div>
//                 <p className="text-sm text-gray-800">{alert.message}</p>
//                 <div className="text-xs text-gray-600">
//                   Value: <span className="font-mono">{alert.details.value}</span> | Device: <span className="font-mono">{alert.details.device_id}</span>
//                 </div>
//               </li>
//             ))}
//           </ul>
//         )}
//       </section>
//       {/* Live Sensor Data */}
//       <section>
//         <h2 className="text-xl font-semibold mt-6 mb-2">📡 Incoming Sensor Data</h2>
//         <ul className="space-y-2">
//           {messages.map((m, i) => (
//             <li key={i} className="border p-2 rounded bg-gray-50">
//               <pre className="text-sm">{JSON.stringify(m, null, 2)}</pre>
//             </li>
//           ))}
//         </ul>
//       </section>

//       {/* Device Responses */}
//       <section>
//         <h2 className="text-xl font-semibold mt-6 mb-2">🪄 Device Responses</h2>
//         <ul className="space-y-2">
//           {responses.map((r, i) => (
//             <li key={i} className="border p-2 rounded bg-green-50">
//               <pre className="text-sm">{JSON.stringify(r, null, 2)}</pre>
//             </li>
//           ))}
//         </ul>
//       </section>