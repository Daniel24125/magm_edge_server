import { getProjectTypeProperties, TProjectTypeProperties } from '@/lib/utils'
import { TProjectType } from '@/types/projects'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card'
import { Avatar, AvatarFallback } from '@radix-ui/react-avatar'


const ProjectType = ({ projectType, info, showText = true }: { projectType: TProjectType, info?: string, showText?: boolean }) => {
    const projectTypeProperties = getProjectTypeProperties(projectType)
    return (<ProjectTypeHoverCard projectTypeProperties={projectTypeProperties}>
        <div style={{
            color: projectTypeProperties.color,
            backgroundColor: projectTypeProperties.color + "33"
        }} className='flex items-center gap-2 justify-between rounded-full px-2 py-1 shrink-0 cursor-default'>
            <div className='flex items-center gap-2'>
                <projectTypeProperties.icon size={15} />
                {showText && <p className='text-xs'>{projectTypeProperties.title}</p>}
            </div>
            {info && <p className='text-sm font-bold'>{info}</p>}
        </div>
    </ProjectTypeHoverCard>

    )
}

const ProjectTypeHoverCard = ({ children, projectTypeProperties }: { children: React.ReactNode, projectTypeProperties: TProjectTypeProperties }) => {
    return (
        <HoverCard>
            <HoverCardTrigger asChild>
                {children}
            </HoverCardTrigger>
            <HoverCardContent>
                <div className="flex justify-between gap-4 items-start">
                    <div style={{
                        backgroundColor: projectTypeProperties.color + "33",
                        color: projectTypeProperties.color
                    }} className='rounded-lg p-2'>
                        <projectTypeProperties.icon size={20} />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold">{projectTypeProperties.title}</h4>
                        <p className="text-sm">
                            {projectTypeProperties.description}
                        </p>
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    )
}

export default ProjectType