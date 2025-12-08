"use client";

import { useEffect, useState, useCallback } from "react";
import Calibration from "./calibration";
import { useMQTT } from "@/contexts/MQTTContext";
import { TCalibrationStatus, TAlert } from "@/types";
import { useUser } from "@auth0/nextjs-auth0";
import { useRouter } from 'next/navigation'
import SessionWidget from "@/components/dashboard/SessionWidget";
import LastSessionWidget from "@/components/dashboard/LastSessionWidget";
import ProjectDetailsWidget from "@/components/dashboard/ProjectDetailsWidget";

const DEVICE_ID = "d09454f7-6a4a-44af-9e0d-eb0bea17e9de";


const COMMAND_TOPIC = "ui/commands";
const DATA_TOPIC = "data_aquisition/sensor_data/rpi_data";
const CAL_PROMPT_TOPIC = `/devices/${DEVICE_ID}/cal/prompt_user`;
const CAL_LIVE_TOPIC = `/devices/${DEVICE_ID}/cal/live_readings`;
const SYSTEM_NOTIF_TOPIC = "system/notifications";
const ALERT_TOPIC = "ui/alerts";
const CAL_TOPICS = [
  CAL_PROMPT_TOPIC,
  CAL_LIVE_TOPIC,
  DATA_TOPIC,
  SYSTEM_NOTIF_TOPIC,
  ALERT_TOPIC
];

export default function Page() {
  const { isConnected, connection, publish } = useMQTT();
  const { user, error, isLoading } = useUser();

  const [messages, setMessages] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);

  const [isRPIConnected, setIsRPIConnected] = useState(false);
  const [calibrationStatus, setCalibrationStatus] = useState<TCalibrationStatus>("READY");
  const [calibrationData, setCalibrationData] = useState<any | null>(null);
  const [liveReading, setLiveReading] = useState<{ ph?: number, stability?: number } | null>(null);
  const [wizardStep, setWizardStep] = useState<string>("IDLE");
  const [onlineDevices, setOnlineDevices] = useState<Record<string, boolean>>({});
  const [alerts, setAlerts] = useState<TAlert[]>([]);

  const router = useRouter()
  useEffect(() => {

    if (isConnected && connection) {
      sendCommand("ping_device", { device_id: DEVICE_ID });
    }
  }, [isConnected, connection]);


  // 5️⃣ Send command to device
  const sendCommand = useCallback((command: string, params: Record<string, any> = {}) => {
    if (!connection || !isConnected) {
      console.warn("Cannot send command, not connected");
      return;
    }
    const topic = `${COMMAND_TOPIC}/${command}`;
    const payload = {
      command,
      params,
    };

    const json_payload = JSON.stringify(payload);
    publish(topic, json_payload);
  }, [connection, isConnected])

  if (isLoading) return <div>Loading...</div>;
  if (!user) return router.push('/auth/login');
  if (error) return <div>Error: {(error as Error).message}</div>;


  return (
    <main className="pt-10 space-y-6">
      <DashboardHeader />
    </main>
  );
}

const DashboardHeader = () => {
  return (
    <div className="w-full justify-between flex items-center gap-4">
      <SessionWidget />
      <LastSessionWidget />
      <ProjectDetailsWidget />
    </div>
  )
}