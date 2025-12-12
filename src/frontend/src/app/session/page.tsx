"use client"

import NoSession from '@/components/projects/NoSession'
import { useSession } from '@/contexts/SessionContext'
import { IProject, TMeasurementType } from '@/types/projects'
import { useEffect, useMemo, useState } from 'react'
import { getProject } from '../actions/projects'
import ProjectType from '@/components/projects/ProjectType'
import { configEnv, configGrowth, formatDate, formatDuration, getAlertIcon } from '@/lib/utils'
import SessionControls from '@/components/sessions/SessionControls'
import { TMeasurement } from '@/types/sessions'
import LineChartComponent from '@/components/LineChartComponent'
import ChartRenderer, { IData } from '@/components/ChartRenderer'
import { format } from 'date-fns'
import AlertTable from '@/components/sessions/AlertTable'

const Session = () => {
    const { activeSession } = useSession()

    if (!activeSession) return <div className='w-full pt-32 flex items-center justify-center'>
        <NoSession size={300} />
    </div>
    return (
        <div className='flex flex-col w-full pt-10 gap-10'>
            <SessionHeader />
            <SessionDataDisplay />
        </div>
    )
}

const SessionHeader = () => {
    const { activeSession } = useSession()
    const [projectDetails, setProjectDetails] = useState<IProject | null>(null)

    useEffect(() => {
        const getProjectDetails = async () => {
            const project = await getProject(activeSession!.projectId)
            if (!project.data) throw new Error("Project not found")
            setProjectDetails(project.data)
        }
        getProjectDetails()
    }, [activeSession])

    if (!projectDetails) return <div className='w-full pt-32 flex items-center justify-center'>
        <p>NO PROJECT FOUND</p>
    </div>

    return (
        <div className='flex items-start gap-2 w-full justify-between'>
            <div className='flex flex-col gap-1 '>
                <h1 className='text-2xl font-bold'>{activeSession!.id}</h1>
                <p>{projectDetails.projectDetails.projectTitle}</p>
            </div>
            <ProjectType
                projectType={projectDetails.projectDetails.projectType}
                info={projectDetails.projectDetails.projectType === "timer" ? formatDuration(projectDetails.projectDetails.timer) : projectDetails.projectDetails.projectType === "target" ? projectDetails.projectDetails.target?.toString() : ""}
            />
        </div>
    )
}

const SessionDataDisplay = () => {
    const { activeSession } = useSession()

    return (
        <div className='flex flex-col w-full gap-4'>
            <div className='flex justify-between items-center w-full gap-2'>
                <div className='w-80 h-80 border rounded-xl flex flex-col items-center justify-evenly p-4'>
                    <SessionControls />
                    <div className='flex flex-col items-center gap-2'>
                        <p className='text-3xl font-bold'>{formatDuration(activeSession!.time)}</p>
                        <p className='text-xs text-text-faded font-medium'>Started at {formatDate(activeSession!.createdAt)}</p>
                    </div>
                </div>
                <SessionChartMonitor />
            </div>
            <AlertTable />
        </div>
    )
}

const SessionChartMonitor = () => {
    const { activeSession, latestLiveMeasurement } = useSession()
    const metrics: TMeasurementType[] = ["ph", "temperature", "od", "co2"]
    const latestMeasurement = useMemo(() => {
        if (latestLiveMeasurement) return latestLiveMeasurement;
        if (!activeSession?.measurements || activeSession.measurements.length === 0) return null
        return activeSession.measurements[activeSession.measurements.length - 1]
    }, [activeSession?.measurements, latestLiveMeasurement])


    return <div className='border rounded-xl h-80 w-full flex-1 flex justify-between overflow-hidden'>
        <div className='w-full flex-1'>
            <SessionChart />
        </div>
        {latestMeasurement && <div className='w-52 shrink-0 h-full bg-slate-300 px-4 py-2 flex flex-col items-start gap-2'>
            <p className='text-text-faded font-semibold text-sm mb-2'>Live Measurements</p>
            {metrics.map((metric) => {
                const measurementProperties = getAlertIcon(metric)
                return <LiveMeasurementItem
                    key={metric}
                    value={latestMeasurement![metric as keyof TMeasurement] ? Number(latestMeasurement![metric as keyof TMeasurement]).toFixed(2) : "--"}
                    label={measurementProperties.label}
                    color={measurementProperties.color}
                    units={measurementProperties.units}
                />
            })}
        </div>}
    </div>
}

const SessionChart = () => {
    const { activeSession } = useSession()
    const { chartData, totalDuration } = useMemo(() => {
        if (!activeSession?.measurements || activeSession.measurements.length === 0) return { chartData: [], totalDuration: 0 }

        const sortedMeasurements = [...activeSession.measurements].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );



        const data = sortedMeasurements.map(m => {
            return {
                timestamp: m.timestamp,
                formattedTime: format(new Date(m.timestamp), "HH:mm:ss"),
                relativeTime: m.session_time!,
                ph: m.ph,
                temperature: m.temperature,
                od: m.od,
                co2: m.co2
            }
        });

        const strings = data.map(d => d.relativeTime);
        const maxTime = Math.max(...strings);

        return { chartData: data, totalDuration: maxTime }
    }, [activeSession?.measurements, activeSession?.createdAt])

    return <div className='w-full p-4 h-full'>
        <ChartRenderer
            totalDuration={totalDuration}
            chartData={chartData}
            chartConfig={{
                ...configEnv,
                ...configGrowth
            }} />

    </div>
}

const LiveMeasurementItem = ({ value, label, color, units }: { value: number | string, label: string, color: string, units: string }) => {
    return <div className='flex flex-col items-start gap-1'>
        <div className='flex gap-2 items-center'>
            <div style={{ backgroundColor: color }} className='w-2.5 h-2.5 rounded-full'></div>
            <p className='text-sm text-text-faded font-medium'>{label}</p>
        </div>
        <p className='text-2xl font-bold ml-3'>{value} {typeof value === "number" ? units : ""}</p>
    </div>
}



export default Session