import { useState, useEffect } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function getTimeAgo(date) {
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

export default function TimeAgo({ date, className }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  if (!date) return <span className={className}>—</span>

  const absolute = new Date(date).toLocaleString()

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className={className}>{getTimeAgo(date)}</span>
      </TooltipTrigger>
      <TooltipContent className="bg-[#1a1a1a] text-[#FAFAFA] border-[#1a1a1a] text-xs">
        {absolute}
      </TooltipContent>
    </Tooltip>
  )
}
