import React, { useEffect, useMemo, useState } from 'react'
import { useProjects } from '@/contexts/ProjectsContext';
import { useSession } from '@/contexts/SessionContext';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';
import ProjectType from '../projects/ProjectType';
import { ProjectSummaryElements } from '../projects/ProjectSummary';
import ProjectMenu from '../projects/ProjectMenu';
import { Separator } from '../ui/separator';
import DataDisplayCard from '../DataDisplayCard';
import { TestTube, Thermometer } from 'lucide-react';
import NoProjects from '../projects/NoProjects';
import { useMediaQuery } from '@/hooks/use-media-query';

const ProjectDetailsWidget = () => {
    const { projects } = useProjects()
    const { activeSession } = useSession()
    const [selectedProjectId, setSelectedProjectId] = useState<string>("")
    const isMobile = useMediaQuery("(max-width: 768px)")


    const sortedProjects = useMemo(() => {
        return [...projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }, [projects])

    const effectiveProjectId = selectedProjectId || (sortedProjects.length > 0 ? sortedProjects[0].id : "")

    const isSessionResponsible = useMemo(() => {
        return activeSession?.projectId === effectiveProjectId
    }, [activeSession, effectiveProjectId])


    const selectedProject = useMemo(() => {
        return projects.find((project) => project.id === effectiveProjectId)
    }, [projects, effectiveProjectId])

    const isDisabled = useMemo(() => {
        return projects.length === 0 || !selectedProject
    }, [projects, selectedProject])


    return (
        <Card className='w-full sm:h-64 min-w-80'>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <ProjectIndicator
                        isActive={isSessionResponsible}
                        isDisabled={isDisabled}
                    />
                    <Select
                        value={effectiveProjectId}
                        onValueChange={setSelectedProjectId}
                        disabled={isDisabled}
                    >
                        <SelectTrigger className='border-none shadow-none p-0 h-auto font-semibold focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none w-auto gap-2 '>
                            <SelectValue placeholder="No projects to select" />
                        </SelectTrigger>
                        <SelectContent>
                            {sortedProjects.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                    {project.projectDetails.projectTitle.length > 25
                                        ? `${project.projectDetails.projectTitle.substring(0, 25)}...`
                                        : project.projectDetails.projectTitle}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardTitle>
                <CardAction className='flex items-center h-full gap-2'>
                    {!isDisabled && <>
                        {!isMobile && <ProjectType projectType={selectedProject!.projectDetails.projectType} />}
                        <ProjectMenu project={selectedProject!} />
                    </>}
                </CardAction>
            </CardHeader>
            <CardContent >
                {isDisabled ? <NoProjects size={150} showButton={false} /> :
                    <div className='flex flex-col sm:flex-row sm:justify-between w-full items-center gap-6'>
                        <div className='sm:w-1/2 w-full sm:min-w-80 flex flex-col gap-2 sm:gap-4 '>
                            <ProjectSummaryElements sessionDetails={selectedProject!.sessionDetails} sessionDefaultSettings={selectedProject!.sessionDefaultSettings} />
                        </div>
                        <Separator className='h-full hidden sm:block' orientation="vertical" />
                        <div className='flex flex-col h-full justify-between items-center gap-2 w-full sm:max-w-44 '>
                            <DataDisplayCard className='' title="Temperature" value="25" unit="°C" color="#F42E25" icon={<Thermometer size={20} />} />
                            <DataDisplayCard className='' title="pH" value="7.2" unit="" color="#8462D1" icon={<TestTube size={20} />} />
                        </div>
                    </div>}
            </CardContent>
        </Card>
    )
}



interface ProjectIndicatorProps {
    isActive: boolean;
    isDisabled: boolean;
}

const ProjectIndicator = ({ isActive, isDisabled }: ProjectIndicatorProps) => {
    return (
        <div className={cn(
            " w-4 h-4 rounded-full border-2 hidden sm:flex items-center justify-center transition-colors outline",
            isActive ? " outline-orange-300 bg-orange-300" : "outline-primary bg-primary",
            isDisabled && "outline-text-faded/30 bg-text-faded/30"
        )}></div>
    )
}

export default ProjectDetailsWidget