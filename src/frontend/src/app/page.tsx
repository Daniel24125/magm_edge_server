"use client";

import { useUser } from "@auth0/nextjs-auth0";
import { useRouter } from 'next/navigation'
import SessionWidget from "@/components/dashboard/SessionWidget";
import ProjectDetailsWidget from "@/components/dashboard/ProjectDetailsWidget";
import ConnectedDevicesWidget from "@/components/dashboard/ConnectedDevicesWidget";
import { SessionChartWidget } from "@/components/dashboard/SessionChartWidget";

export default function Page() {
  const { user, error, isLoading } = useUser();
  const router = useRouter()


  if (isLoading) return <div>Loading...</div>;
  if (!user) return router.push('/auth/login');
  if (error) return <div>Error: {(error as Error).message}</div>;


  return (
    <main className="pt-10 space-y-6 flex flex-col pb-4">
      <DashboardHeader />
      <SessionChartWidget />
    </main>
  );
}

const DashboardHeader = () => {
  return (
    <div className="w-full justify-between flex items-center gap-4 pb-2 flex-wrap 2xl:flex-nowrap">
      <SessionWidget />
      <div className="min-w-80 w-full lg:w-auto lg:min-w-0 lg:flex-1">
        <ProjectDetailsWidget />
      </div>
      <div className="shrink-0 w-full 2xl:w-auto">
        <ConnectedDevicesWidget />
      </div>
    </div>
  )
}