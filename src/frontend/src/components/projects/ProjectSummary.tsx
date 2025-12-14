import { Biohazard, Gauge, TestTube, Thermometer, Waves } from 'lucide-react';
import { useProjectFormContext } from './ProjectForm';
import { TSessionDefaultSettings, TSessionDetails, TSummaryElementProps } from '@/types/projects';
import ProjectType from './ProjectType';
import { formatDuration } from '@/lib/utils';
import DataDisplayCard from '../DataDisplayCard';
import ProjectSettingElement from './ProjectSettingElement';

export const ProjectFormSummary = () => {
    const { getValues } = useProjectFormContext();
    const sessionDetails = getValues("sessionDetails");
    const sessionDefaultSettings = getValues("sessionDefaultSettings");
    return (<div className='w-full flex flex-col gap-4'>
        <ProjectFormHeader />
        <ProjectSummaryElements sessionDetails={sessionDetails} sessionDefaultSettings={sessionDefaultSettings} />
        <div className='w-full flex justify-between gap-4 my-4 '>
            <DataDisplayCard title="Temperature" value="25" unit="°C" color="#F42E25" icon={<Thermometer size={20} />} />
            <DataDisplayCard title="pH" value="7.2" unit="" color="#8462D1" icon={<TestTube size={20} />} />
        </div>
        <AlertSummaryComponent />
    </div>
    )
}

const AlertSummaryComponent = () => {
    const { getValues } = useProjectFormContext();
    const alerts = getValues("alertConfiguration");

    return <>
        <h6>Alerts</h6>
        <div className='w-full flex flex-col gap-2'>
            {alerts.filter((alert) => alert.enabled).map((alert, index) => {
                return <div key={index} className='w-full flex items-center gap-2 justify-between'>
                    <p className='text-text-faded'>
                        {alert.alertType}
                    </p>
                    <p className='font-bold'>{alert.threshold}</p>
                </div>
            })}
        </div>
    </>
}


export const ProjectSummaryElements = ({ sessionDetails, sessionDefaultSettings }: { sessionDetails: TSessionDetails, sessionDefaultSettings: TSessionDefaultSettings }) => {
    return (<>
        <div className='flex flex-col sm:flex-row justify-between gap-4'>
            <ProjectSettingElement title="Reactor Name" value={sessionDetails && sessionDetails.reactorName ? sessionDetails.reactorName : "Not available"} icon={<Biohazard size={20} />} color="#8462D1" />
            <ProjectSettingElement title="CO2 Pressure" value={sessionDetails && sessionDetails.co2Pressure ? sessionDetails.co2Pressure.toString() : "Not available"} icon={<Gauge size={20} />} color="#17B8A6" />
        </div>
        <div className='flex flex-col sm:flex-row justify-between gap-4'>
            <ProjectSettingElement title="Medium Composition" value={sessionDetails && sessionDetails.cultureMedium ? sessionDetails.cultureMedium : "Not available"} icon={<Waves size={20} />} color="#74B9FF" />
            <ProjectSettingElement title="Data Aquisition" value={sessionDefaultSettings && sessionDefaultSettings.dataAcquisitionInterval ? `Every ${sessionDefaultSettings.dataAcquisitionInterval} minutes` : "Not available"} icon={<Gauge size={20} />} color="#000000" />
        </div>
    </>
    )
}

const ProjectFormHeader = () => {
    const { getValues } = useProjectFormContext();
    const projectTitle = getValues("projectDetails.projectTitle");
    const sampleName = getValues("sessionDetails.sampleName");
    const projectType = getValues("projectDetails.projectType");
    const timerDuration = getValues("projectDetails.timer");
    const targetValue = getValues("projectDetails.target");

    return <div className='w-full flex items-start justify-between my-4'>
        <div className='flex flex-col'>
            <h6 className='font-bold text-lg max-w-56'>{projectTitle}</h6>
            <p className='text-text-faded text-xs'>{sampleName}</p>
        </div>
        <div>
            <ProjectType showText={false} projectType={projectType} info={targetValue ? targetValue.toString() : timerDuration ? formatDuration(timerDuration) : ""} />
        </div>
    </div>
}



