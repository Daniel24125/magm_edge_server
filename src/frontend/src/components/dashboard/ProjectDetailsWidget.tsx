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

const ProjectDetailsWidget = () => {
    const { projects } = useProjects()
    const { activeSession } = useSession()
    const [selectedProjectId, setSelectedProjectId] = useState<string>("")

    const sortedProjects = useMemo(() => {
        return [...projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }, [projects])

    useEffect(() => {
        if (sortedProjects.length > 0 && !selectedProjectId) {
            setSelectedProjectId(sortedProjects[0].id)
        }
    }, [sortedProjects, selectedProjectId])

    const isSessionResponsible = useMemo(() => {
        return activeSession?.projectId === selectedProjectId
    }, [activeSession, selectedProjectId])


    const selectedProject = useMemo(() => {
        return projects.find((project) => project.id === selectedProjectId)
    }, [projects, selectedProjectId])

    const isDisabled = useMemo(() => {
        return projects.length === 0 || !selectedProject
    }, [projects, selectedProject])


    return (
        <Card className='w-full h-64'>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <ProjectIndicator
                        isActive={isSessionResponsible}
                        isDisabled={isDisabled}
                    />
                    <Select
                        value={selectedProjectId}
                        onValueChange={setSelectedProjectId}
                        disabled={isDisabled}
                    >
                        <SelectTrigger className='border-none shadow-none p-0 h-auto font-semibold focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none w-auto gap-2 '>
                            <SelectValue placeholder="No projects to select" />
                        </SelectTrigger>
                        <SelectContent>
                            {sortedProjects.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                    {project.projectDetails.projectTitle}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardTitle>
                <CardAction className='flex items-center h-full gap-2'>
                    {!isDisabled && <>
                        <ProjectType projectType={selectedProject!.projectDetails.projectType} />
                        <ProjectMenu project={selectedProject!} />
                    </>}
                </CardAction>
            </CardHeader>
            <CardContent>
                {isDisabled ? <NoProjectSelected /> : <div className='flex justify-between w-full items-center'>
                    <div className='w-1/2 min-w-64 flex flex-col gap-4 '>
                        <ProjectSummaryElements sessionDetails={selectedProject!.sessionDetails} sessionDefaultSettings={selectedProject!.sessionDefaultSettings} />
                    </div>
                    <Separator className='h-full' orientation="vertical" />
                    <div className='flex flex-col h-full justify-between items-center gap-2 w-full max-w-44'>
                        <DataDisplayCard title="Temperature" value="25" unit="°C" color="#F42E25" icon={<Thermometer size={20} />} />
                        <DataDisplayCard title="pH" value="7.2" unit="" color="#8462D1" icon={<TestTube size={20} />} />
                    </div>
                </div>}
            </CardContent>
        </Card>
    )
}

const NoProjectSelected = () => {
    return <div className='w-full justify-center items-center h-full'>


    </div>
}

interface ProjectIndicatorProps {
    isActive: boolean;
    isDisabled: boolean;
}

const ProjectIndicator = ({ isActive, isDisabled }: ProjectIndicatorProps) => {
    return (
        <div className={cn(
            "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors outline",
            isActive ? " outline-orange-300 bg-orange-300" : "outline-primary bg-primary",
            isDisabled && "outline-text-faded/30 bg-text-faded/30"
        )}></div>
    )
}

export default ProjectDetailsWidget