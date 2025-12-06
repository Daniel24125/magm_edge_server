"use client"
import { NoProjectsIlustration } from '@/components/ilustrations'
import ProjectType from '@/components/projects/ProjectType'
import ActionMenu from '@/components/ui/action-menu'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useProjects } from '@/contexts/ProjectsContext'
import { IProject } from '@/types/projects'
import { Edit, Eye, Filter, Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import DeleteConfirmationDialog from '@/components/ui/delete-confirmation-dialog'
import { getSessions } from '../actions/sessions'
import { ISession } from '@/types/sessions'
import NoSession from '@/components/projects/NoSession'

const ProjectsPage = () => {
    const { projects } = useProjects()
    if (projects.length === 0) return <NoProjects />

    return (
        <div className='flex flex-col gap-10 h-full w-full pt-10'>
            <SearchProjects />
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

const NoProjects = () => {
    const { setOpen } = useProjects()
    return (
        <div className='flex flex-col gap-5 justify-center items-center w-full pt-10'>
            <NoProjectsIlustration width={300} />
            <h6>You have no projects yet</h6>
            <Button onClick={() => setOpen(true)} >Create a project</Button>
        </div>
    )
}

const ProjectMenu = ({ project }: { project: IProject }) => {
    const { setOpen, setMode, setSelectedProject, removeProject } = useProjects()
    const router = useRouter()
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    return <>
        <ActionMenu items={[
            {
                label: "View",
                icon: <Eye />,
                onClick: () => {
                    router.push(`/projects/${project.id}`)
                }
            },
            {
                label: "Edit",
                icon: <Edit />,
                onClick: () => {
                    setSelectedProject(project)
                    setMode('edit')
                    setOpen(true)
                }
            },
            {
                label: "Delete",
                icon: <Trash />,
                variant: 'destructive',
                onClick: () => setDeleteDialogOpen(true)
            }
        ]} />
        <DeleteConfirmationDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onConfirm={() => removeProject(project.id)}
            title={`Delete Project "${project.projectDetails.projectTitle}"?`}
            description="This action cannot be undone. This will permanently delete the project and all associated sessions."
        />
    </>
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

    useEffect(() => {
        const getSessionData = async () => {
            const sessions = await getSessions(projectID)
            setSessions(sessions.data || [])
        }
        getSessionData()
    }, [projectID])


    const hasSessions = useMemo(() => sessions.length > 0, [sessions])
    return (<>
        {hasSessions ? (
            <>
                {sessions.map((session) => (
                    <div key={session.id}>
                        <p>{session.id}</p>
                    </div>
                ))}
            </>
        ) : (
            <NoSession size={150} />
        )}
    </>
    )

}

export default ProjectsPage
