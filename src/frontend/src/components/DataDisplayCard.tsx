import React, { useRef, useState, useEffect } from 'react'

type DataDisplayProps = {
    title: string;
    value: string;
    unit?: string;
    color: string;
    className?: string;
    icon?: React.ReactNode;
}

const DataDisplayCard = ({ title, value, unit, color, className, icon }: DataDisplayProps) => {
    const ref = useRef<HTMLDivElement>(null)
    const [isSmall, setIsSmall] = useState(false)

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setIsSmall(entry.contentRect.width < 130)
            }
        })

        if (ref.current) {
            observer.observe(ref.current)
        }

        return () => observer.disconnect()
    }, [])

    return (
        <div ref={ref} style={{
            backgroundColor: color + "33",
            color: color
        }} className={`w-full flex flex-col gap-2 ${className} rounded-lg p-2`}>
            <div className='flex items-center gap-2'>
                {icon}
                {!isSmall && <p className='text-sm whitespace-nowrap'>{title}</p>}
            </div>
            <div className='flex items-center gap-2 w-full justify-end'>
                <span className='font-bold text-xl'>{value}</span>
                <span className='text-xs'>{unit}</span>
            </div>
        </div>
    )
}

export default DataDisplayCard