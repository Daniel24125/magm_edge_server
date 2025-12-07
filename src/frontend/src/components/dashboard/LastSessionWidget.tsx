import React from 'react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '../ui/card'
import { useProjects } from '@/contexts/ProjectsContext'
import { ISession } from '@/types/sessions'
import NoSession from '../projects/NoSession'

const LastSessionWidget = () => {
    const { getLastSession } = useProjects()
    const [lastSession, setLastSession] = React.useState<ISession | null>(null)

    React.useEffect(() => {
        getLastSession().then(setLastSession)
    }, [getLastSession])

    return <Card className='w-96 h-64'>
        <CardHeader>
            <CardTitle>
                <p>Latest Session</p>
                {lastSession && <p className='text-xs text-text-faded/50'>{lastSession.createdAt}</p>}
            </CardTitle>
            {lastSession && <CardAction>
                <AlertInformation />
            </CardAction>}
        </CardHeader>
        <CardContent>
            {lastSession ? <p>{lastSession.createdAt}</p> : <NoSession size={100} />}
        </CardContent>
    </Card>
}

const AlertInformation = () => {
    return "alerts"
}

export default LastSessionWidget