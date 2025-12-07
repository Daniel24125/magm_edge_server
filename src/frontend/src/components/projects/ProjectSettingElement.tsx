import { TSummaryElementProps } from '@/types/projects'

const ProjectSettingElement = ({ title, value, icon, color }: TSummaryElementProps) => {
    return <div className='flex flex-col gap-1 min-w-40'>
        <div className='flex items-center gap-2'>
            <div style={{ backgroundColor: `${color}33`, color: `${color}80` }} className='w-6 h-6  rounded-sm flex items-center justify-center'>
                {icon}
            </div>
            <p className='text-text-faded text-xs'>{title}</p>
        </div>
        <p className='font-bold'>{value}</p>
    </div>
}

export default ProjectSettingElement