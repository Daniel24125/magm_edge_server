import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface DurationPickerProps {
    value?: number
    onChange: (value: number) => void
    className?: string
}

export function DurationPicker({ value = 0, onChange, className }: DurationPickerProps) {
    const [days, setDays] = React.useState(Math.floor(value / 86400))
    const [hours, setHours] = React.useState(Math.floor((value % 86400) / 3600))
    const [minutes, setMinutes] = React.useState(Math.floor((value % 3600) / 60))

    React.useEffect(() => {
        setDays(Math.floor(value / 86400))
        setHours(Math.floor((value % 86400) / 3600))
        setMinutes(Math.floor((value % 3600) / 60))
    }, [value])

    const handleChange = (type: "days" | "hours" | "minutes", val: string) => {
        const numVal = parseInt(val) || 0
        let newDays = days
        let newHours = hours
        let newMinutes = minutes

        if (type === "days") newDays = numVal
        if (type === "hours") newHours = numVal
        if (type === "minutes") newMinutes = numVal

        // Update local state immediately for better UX
        if (type === "days") setDays(numVal)
        if (type === "hours") setHours(numVal)
        if (type === "minutes") setMinutes(numVal)

        const totalSeconds = newDays * 86400 + newHours * 3600 + newMinutes * 60
        onChange(totalSeconds)
    }

    return (
        <div className={cn("flex items-end gap-2", className)}>
            <div className="grid gap-1.5 text-center">
                <Label htmlFor="days" className="text-xs text-muted-foreground">Days</Label>
                <Input
                    id="days"
                    type="number"
                    min={0}
                    value={days}
                    onChange={(e) => handleChange("days", e.target.value)}
                    className="w-16 text-center"
                />
            </div>
            <span className="pb-2 font-bold text-muted-foreground">:</span>
            <div className="grid gap-1.5 text-center">
                <Label htmlFor="hours" className="text-xs text-muted-foreground">Hours</Label>
                <Input
                    id="hours"
                    type="number"
                    min={0}
                    max={23}
                    value={hours}
                    onChange={(e) => handleChange("hours", e.target.value)}
                    className="w-16 text-center"
                />
            </div>
            <span className="pb-2 font-bold text-muted-foreground">:</span>
            <div className="grid gap-1.5 text-center">
                <Label htmlFor="minutes" className="text-xs text-muted-foreground">Mins</Label>
                <Input
                    id="minutes"
                    type="number"
                    min={0}
                    max={59}
                    value={minutes}
                    onChange={(e) => handleChange("minutes", e.target.value)}
                    className="w-16 text-center"
                />
            </div>
        </div>
    )
}
