"use client";

import { useUser } from "@auth0/nextjs-auth0";
import { useRouter } from 'next/navigation'
import SessionWidget from "@/components/dashboard/SessionWidget";
import LastSessionWidget from "@/components/dashboard/LastSessionWidget";
import ProjectDetailsWidget from "@/components/dashboard/ProjectDetailsWidget";
import LiveMeasurementsWidget from "@/components/dashboard/LiveMeasurementsWidget";
import ConnectedDevicesWidget from "@/components/dashboard/ConnectedDevicesWidget";
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
      <ProjectDetailsWidget />
      <ConnectedDevicesWidget />
    </div>
  )
}