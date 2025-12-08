"use client"
import { useProjects } from '@/contexts/ProjectsContext'
import React from 'react'
import { NoProjectsIlustration } from '../ilustrations'
import { Button } from '../ui/button'



const NoProjects = ({ size = 300, showButton = true, className }: { size?: number, showButton?: boolean, className?: string }) => {
    const { setOpen } = useProjects()
    return (
        <div className={`flex flex-col gap-5 justify-center items-center w-full ${className}`}>
            <NoProjectsIlustration width={size} />
            <h6>You have no projects yet</h6>
            {showButton && <Button className='text-primary' size={"sm"} variant={"ghost"} onClick={() => setOpen(true)} >Create a project</Button>}
        </div>
    )
}
export default NoProjects