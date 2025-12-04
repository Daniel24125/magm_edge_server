import { Biohazard, Gauge, Waves } from 'lucide-react';
import { useProjectFormContext } from './ProjectForm';
import { TSessionDefaultSettings, TSessionDetails } from '@/types/projects';
import ProjectType from './ProjectType';

type TSummaryElementProps = {
    title: string;
    value: string;
    icon?: React.ReactNode;
    color?: string;
}

const SummaryElement = ({ title, value, icon, color }: TSummaryElementProps) => {
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


export const ProjectSummaryElements = ({ sessionDetails, sessionDefaultSettings }: { sessionDetails: TSessionDetails, sessionDefaultSettings: TSessionDefaultSettings }) => {
    return (<>

        <div className='flex justify-between gap-4'>
            <SummaryElement title="Reactor Name" value={sessionDetails && sessionDetails.reactorName ? sessionDetails.reactorName : "Not available"} icon={<Biohazard size={20} />} color="#8462D1" />
            <SummaryElement title="CO2 Pressure" value={sessionDetails && sessionDetails.co2Pressure ? sessionDetails.co2Pressure.toString() : "Not available"} icon={<Gauge size={20} />} color="#17B8A6" />
        </div>
        <div className='flex justify-between gap-4'>
            <SummaryElement title="Medium Composition" value={sessionDetails && sessionDetails.cultureMedium ? sessionDetails.cultureMedium : "Not available"} icon={<Waves size={20} />} color="#74B9FF" />
            <SummaryElement title="Data Aquisition" value={sessionDefaultSettings && sessionDefaultSettings.dataAcquisitionInterval ? `Every ${sessionDefaultSettings.dataAcquisitionInterval} minutes` : "Not available"} icon={<Gauge size={20} />} color="#000000" />
        </div>
    </>
    )
}

const ProjectFormHeader = () => {
    const { getValues } = useProjectFormContext();
    const projectTitle = getValues("projectDetails.projectTitle");
    const sampleName = getValues("sessionDetails.sampleName");
    const projectType = getValues("projectDetails.projectType");

    return <div className='w-full flex items-center justify-between mb-4'>
        <div className='flex flex-col'>
            <h6 className='font-bold text-lg'>{projectTitle}</h6>
            <p className='text-text-faded text-xs'>{sampleName}</p>
        </div>
        <div>
            <ProjectType projectType={projectType} />
        </div>
    </div>
}

export const ProjectFormSummary = () => {
    const { getValues } = useProjectFormContext();
    const sessionDetails = getValues("sessionDetails");
    const sessionDefaultSettings = getValues("sessionDefaultSettings");
    return (<div className='w-full flex flex-col gap-4'>
        <ProjectFormHeader />
        <ProjectSummaryElements sessionDetails={sessionDetails} sessionDefaultSettings={sessionDefaultSettings} />
    </div>
    )
}

