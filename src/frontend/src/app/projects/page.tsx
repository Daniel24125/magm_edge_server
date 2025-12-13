"use client"
import ProjectType from '@/components/projects/ProjectType'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useProjects } from '@/contexts/ProjectsContext'
import { IProject, TMeasurementType } from '@/types/projects'
import { Filter } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getSessionMeasurements, getSessions } from '../actions/sessions'
import { ISession, TMeasurement } from '@/types/sessions'
import NoSession from '@/components/projects/NoSession'
import ProjectMenu from '@/components/projects/ProjectMenu'
import NoProjects from '@/components/projects/NoProjects'
import { formatDuration, getAlertIcon, getFormartedTimeWithLetters } from '@/lib/utils'
import { NoMeasurementsIlustration } from '@/components/ilustrations'
import Loading from '@/components/ui/loading'

const ProjectsPage = () => {
    const { projects } = useProjects()
    if (projects.length === 0) return <NoProjects className='pt-10' />

    return (
        <div className='flex flex-col gap-10 h-full w-full pt-20'>
            {/* <SearchProjects /> */}
            <ProjectListCards />
        </div>
    )
}


const SearchProjects = () => {


    return (
        <div className='flex w-full justify-between items-center'>
            <Field className='w-full max-w-96'>
                <Input placeholder='Search projects...' />
            </Field>
            <Button variant='outline' size='icon'>
                <Filter size={20} />
            </Button>
        </div>
    )
}

const ProjectListCards = () => {
    const { projects } = useProjects()

    return (
        <div className='flex justify-evenly flex-wrap gap-5 w-full'>
            {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
            ))}
        </div>
    )
}


const ProjectCard = ({ project }: { project: IProject }) => {
    return (
        <>
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>{project.projectDetails.projectTitle}</CardTitle>
                    <CardDescription>
                        {project.id}
                    </CardDescription>
                    <CardAction className='flex gap-2'>
                        <ProjectType projectType={project.projectDetails.projectType} showText={false} />
                        <ProjectMenu project={project} />
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <ProjectSessionSummary projectID={project.id} />
                </CardContent>
            </Card>

        </>
    )
}

const ProjectSessionSummary = ({ projectID }: { projectID: string }) => {
    const [sessions, setSessions] = useState<ISession[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const getSessionData = async () => {
            setIsLoading(true)
            try {
                const sessions = await getSessions(projectID)
                setSessions(sessions.data || [])
            } catch (e) {
                console.error(e)
            } finally {
                setIsLoading(false)
            }
        }
        getSessionData()
    }, [projectID])

    const hasSessions = useMemo(() => sessions.length > 0, [sessions])
    const lastSession = useMemo(() => !hasSessions ? null : sessions.length > 0 ? sessions[sessions.length - 1] : null, [sessions])

    if (isLoading) return <div className='py-10 flex justify-center'><Loading isLoading={true} /></div>

    if (!hasSessions) return <NoSession size={150} />

    return (
        <div className="flex flex-col items-center gap-4 mt-5">
            <h6 className='text-2xl font-bold'>{getFormartedTimeWithLetters(lastSession?.time)}</h6>
            <LastSessionMeasurements sessionID={lastSession!.id} />
        </div>
    )

}

const LastSessionMeasurements = ({ sessionID }: { sessionID: string }) => {
    const [measurements, setMeasurements] = useState<TMeasurement[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const measurementTypes: TMeasurementType[] = ["od", "ph", "temperature"]

    useEffect(() => {
        const getMeasurementData = async () => {
            setIsLoading(true)
            try {
                const measurements = await getSessionMeasurements(sessionID)
                setMeasurements(measurements.data || [])
            } catch (e) {
                console.error(e)
            } finally {
                setIsLoading(false)
            }
        }
        getMeasurementData()
    }, [sessionID])

    const lastMeasurement = useMemo(() => measurements.length > 0 ? measurements[measurements.length - 1] : null, [measurements])

    if (isLoading) return <div className='py-4 flex justify-center'><Loading isLoading={true} /></div>

    if (!lastMeasurement) return <NoMeasurements size={150} />

    return (
        <div className="flex justify-between items-center w-full">
            {measurementTypes.map(mType => <MeasurementItem measurementType={mType} measurementValue={lastMeasurement[mType] as number} />)}
        </div>
    )
}

const MeasurementItem = ({ measurementType, measurementValue }: { measurementType: TMeasurementType, measurementValue: number }) => {
    const measurementProperties = getAlertIcon(measurementType)
    const value = useMemo(() => measurementValue ? Number(measurementValue).toFixed(2) : "--", [measurementValue])
    return (
        <div className="flex flex-col gap-1 items-center">
            <div style={{ color: measurementProperties!.color }} className='flex gap-2 items-center'>
                {/* @ts-ignore */}
                <measurementProperties.icon className="w-5 h-5" />
                <span className='font-bold text-lg'>{value} {measurementProperties!.units}</span>
            </div>
            <p style={{ color: measurementProperties!.color }} className="text-sm text-text-faded font-medium">Last {measurementProperties!.label}</p>
        </div>
    )
}


const NoMeasurements = ({ size }: { size: number }) => {
    return (
        <div className='flex flex-col items-center gap-2'>
            <NoMeasurementsIlustration width={size} />
            <p className='text-sm text-text-faded font-medium'>No measurements in this session</p>
        </div>
    )
}
export default ProjectsPage
