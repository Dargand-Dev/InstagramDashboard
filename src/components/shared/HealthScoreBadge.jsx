import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function getColor(score) {
  if (score >= 80) return '#22C55E'
  if (score >= 50) return '#F59E0B'
  return '#EF4444'
}

export default function HealthScoreBadge({ score = 0, size = 36, className }) {
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = getColor(score)

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger render={<div className={cn('inline-flex items-center justify-center relative', className)} style={{ width: size, height: size }} />}>
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#1a1a1a"
              strokeWidth={3}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <span
            className="absolute text-[10px] font-semibold"
            style={{ color }}
          >
            {score}
          </span>
      </TooltipTrigger>
      <TooltipContent className="bg-[#1a1a1a] text-[#FAFAFA] border-[#1a1a1a] text-xs">
        Health Score: {score}/100
      </TooltipContent>
    </Tooltip>
  )
}
