"use client"
import { useProjects } from '@/contexts/ProjectsContext'
import { IProject } from '@/types/projects'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ActionMenu from '../ui/action-menu'
import { Edit, Eye, Trash } from 'lucide-react'
import DeleteConfirmationDialog from '../ui/delete-confirmation-dialog'

type TProjectMenuProps = {
    project: IProject,
}


const ProjectMenu = ({ project }: TProjectMenuProps) => {
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
export default ProjectMenu