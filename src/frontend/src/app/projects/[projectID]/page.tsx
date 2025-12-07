import { getProject } from '@/app/actions/projects'
import DataDisplayCard from '@/components/DataDisplayCard'
import NoSession from '@/components/projects/NoSession'
import ProjectMenu from '@/components/projects/ProjectMenu'
import { ProjectSummaryElements } from '@/components/projects/ProjectSummary'
import ProjectType from '@/components/projects/ProjectType'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjects } from '@/contexts/ProjectsContext'
import { getAlertIcon } from '@/lib/utils'
import { IProject, TAlertConfiguration, TSessionDetails } from '@/types/projects'
import { ISession } from '@/types/sessions'
import { ArrowLeft, Bolt, CircleAlert, TestTube, Thermometer } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React, { useMemo } from 'react'

interface ProjectDetailsPageProps {
    params: Promise<{
        projectID: string
    }>
}

export default async function ProjectDetailsPage({ params }: ProjectDetailsPageProps) {
    const { projectID } = await params
    const { success, data: project, error } = await getProject(projectID)

    if (!success || !project) {
        if (error === "Project not found") {
            notFound()
        }
        return <div>Error loading project: {error}</div>
    }

    return (
        <div className="flex flex-col gap-6 p-6 w-full">
            <ProjectDetaildHeader project={project} />
            <ProjectDetailsBody project={project} />
            <ProjectSessionList sessions={project.sessions} />
        </div>
    )
}

const ProjectDetaildHeader = ({ project }: { project: IProject }) => {
    return <div className='flex justify-between items-center'>
        <div className='flex flex-col gap-1'>
            <h1 className="text-2xl font-bold">{project.projectDetails.projectTitle}</h1>
            <p className="text-muted-foreground text-sm">{project.id}</p>
        </div>
        <div className='flex gap-2'>
            <ProjectType projectType={project.projectDetails.projectType} />
            <ProjectMenu project={project} />
        </div>
    </div>
}

const ProjectDetailsBody = ({ project }: { project: IProject }) => {
    return <div className='flex justify-between items-center h-56 w-full gap-4'>
        <Card className='w-1/2 max-w-xl shrink-0'>
            <CardHeader>
                <CardTitle className='text-primary flex items-center gap-2 text-sm font-bold '> <Bolt size={20} /> Project Details</CardTitle>
            </CardHeader>
            <CardContent className='flex flex-col gap-4'>
                <ProjectSummaryElements sessionDetails={project.sessionDetails} sessionDefaultSettings={project.sessionDefaultSettings} />
            </CardContent>
        </Card>
        <div className='flex flex-col h-full justify-between items-center gap-2 w-full max-w-44'>
            <DataDisplayCard title="Temperature" value="25" unit="°C" color="#F42E25" icon={<Thermometer size={20} />} />
            <DataDisplayCard title="pH" value="7.2" unit="" color="#8462D1" icon={<TestTube size={20} />} />
        </div>
        <AlertConfigurationDetails alerts={project.alertConfiguration} />
    </div>
}

const AlertConfigurationDetails = ({ alerts }: { alerts: TAlertConfiguration[] }) => {
    return <Card className='w-full h-full'>
        <CardHeader>
            <CardTitle className='text-destructive flex items-center gap-2 text-sm font-bold '> <CircleAlert size={20} /> Alerts</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-1'>
            {alerts.map((alert, index) => {
                return <AlertElement key={index} alert={alert} />
            })}
        </CardContent>
    </Card>
}

const AlertElement = ({ alert }: { alert: TAlertConfiguration }) => {
    const { icon, color, label, units } = getAlertIcon(alert.alertType)

    const colorStyles = {
        color: alert.enabled ? color : "#7C7C7C",
        backgroundColor: alert.enabled ? color + "33" : "#f0f0f0"
    }
    return <div className='w-full flex items-center justify-between rounded-lg border px-2 py-1'>
        <div className='flex items-center gap-2'>
            <div style={colorStyles} className='rounded-sm p-1'>
                {React.createElement(icon, { size: 15 })}
            </div>
            <span className='text-sm' style={{ color: colorStyles.color }}>{label}</span>
        </div>
        <div style={colorStyles} className='rounded-sm p-1 min-w-12 text-center'>
            <p className='font-bold'>
                {alert.enabled ? `${alert.threshold} ${units}` : "-"}
            </p>
        </div>
    </div>
}


const ProjectSessionList = ({ sessions }: { sessions: ISession[] }) => {
    const hasSessions = useMemo(() => !!sessions && sessions.length > 0, [sessions])

    return <div className=' w-full pt-10'>
        {hasSessions ? <SessionList sessions={sessions} /> : <NoSession size={300} />}
    </div>
}

const SessionList = ({ sessions }: { sessions: ISession[] }) => {
    return <div>
        {sessions.map((session, index) => {
            return <p>
                {session.id}
            </p>
        })}
    </div>
}