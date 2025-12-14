
import { getProject } from '@/app/actions/projects'
import DataDisplayCard from '@/components/DataDisplayCard'
import ProjectMenu from '@/components/projects/ProjectMenu'
import ProjectSessionList from '@/components/projects/ProjectSessions'
import { ProjectSummaryElements } from '@/components/projects/ProjectSummary'
import ProjectType from '@/components/projects/ProjectType'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatDuration, getAlertIcon } from '@/lib/utils'
import { IProject, TAlertConfiguration } from '@/types/projects'
import { Bolt, CircleAlert, TestTube, Thermometer } from 'lucide-react'
import { notFound } from 'next/navigation'
import React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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
        <div className="flex flex-col gap-6 py-6 md:p-6 w-full">
            <ProjectDetailHeader project={project} />
            <ProjectDetailsBody project={project} />
            <ProjectSessionList projectID={project.id} />
        </div>
    )
}



const ProjectDetailHeader = ({ project }: { project: IProject }) => {
    return <div className='flex justify-between items-center'>
        <div className='flex flex-col gap-1'>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <h1 className="text-lg md:text-2xl font-bold">{project.projectDetails.projectTitle.length > 50
                            ? `${project.projectDetails.projectTitle.substring(0, 50)}...`
                            : project.projectDetails.projectTitle}</h1>
                    </TooltipTrigger>
                    {project.projectDetails.projectTitle.length > 50 && (
                        <TooltipContent>
                            <p>{project.projectDetails.projectTitle}</p>
                        </TooltipContent>
                    )}
                </Tooltip>
            </TooltipProvider>
            <p className="text-muted-foreground text-xs md:text-sm">{project.id}</p>
        </div>
        <div className='flex gap-2'>
            <ProjectType
                className="lg:hidden"
                projectType={project.projectDetails.projectType}
                info={project.projectDetails.projectType === "timer" ? formatDuration(project.projectDetails.timer) : project.projectDetails.projectType === "target" ? project.projectDetails.target?.toString() : ""} />
            <ProjectMenu project={project} />
        </div>
    </div>
}

const ProjectDetailsBody = ({ project }: { project: IProject }) => {
    return <div className='flex justify-between items-center flex-wrap lg:flex-nowrap h-auto lg:h-56 w-full gap-4'>
        <Card className='w-full lg:w-1/2 lg:max-w-xl shrink-0 md:h-56 lg:h-full'>
            <CardHeader>
                <CardTitle className='text-primary flex items-center gap-2 text-sm font-bold '> <Bolt size={20} /> Project Details</CardTitle>
            </CardHeader>
            <CardContent className='flex flex-col gap-4'>
                <ProjectSummaryElements sessionDetails={project.sessionDetails} sessionDefaultSettings={project.sessionDefaultSettings} />
            </CardContent>
        </Card>
        <div className='flex flex-col lg:h-full justify-between items-center gap-2 w-full lg:max-w-44'>
            <DataDisplayCard title="Temperature" value="25" unit="°C" color="#F42E25" icon={<Thermometer size={20} />} />
            <DataDisplayCard title="pH" value="7.2" unit="" color="#8462D1" icon={<TestTube size={20} />} />
        </div>
        <div className='w-full lg:w-auto lg:flex-1 h-56 lg:h-full'>
            <AlertConfigurationDetails alerts={project.alertConfiguration} />
        </div>
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
                {alert.enabled ? `<${alert.threshold} ${units}` : "-"}
            </p>
        </div>
    </div>
}


