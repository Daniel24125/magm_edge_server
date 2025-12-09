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

import LiveMeasurementsWidget from "@/components/dashboard/LiveMeasurementsWidget";
import { SessionChartWidget } from "@/components/dashboard/SessionChartWidget";

export default function Page() {
  const { user, error, isLoading } = useUser();
  const router = useRouter()



  if (isLoading) return <div>Loading...</div>;
  if (!user) return router.push('/auth/login');
  if (error) return <div>Error: {(error as Error).message}</div>;


  return (
    <main className="pt-10 space-y-6">
      <DashboardHeader />
      <SessionChartWidget />
      <LiveMeasurementsWidget />
    </main>
  );
}

const DashboardHeader = () => {
  return (
    <div className="w-full justify-between flex items-center gap-4 overflow-x-auto pb-2">
      <SessionWidget />
      <LastSessionWidget />
      <ProjectDetailsWidget />
    </div>
  )
}