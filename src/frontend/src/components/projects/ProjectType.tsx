import { getProjectTypeProperties } from '@/lib/utils'
import { TProjectType } from '@/types/projects'


const ProjectType = ({ projectType, info }: { projectType: TProjectType, info?: string }) => {
    const projectTypeProperties = getProjectTypeProperties(projectType)
    return (<div style={{
        color: projectTypeProperties.color,
        backgroundColor: projectTypeProperties.color + "33"
    }} className='flex items-center gap-2 justify-between rounded-full px-2 py-1'>
        <div className='flex items-center gap-2'>
            <projectTypeProperties.icon className="w-4 h-4" />
            <p>{projectTypeProperties.title}</p>
        </div>
        {info && <p className='text-text-faded text-xs'>{info}</p>}
    </div>
    )
}

export default ProjectType