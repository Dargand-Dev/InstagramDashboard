import { useEffect, useState } from 'react'
import { buildTimelineRows, TIMELINE_STATUSES } from './timelineData'

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function formatTimeLabel(ms) {
  if (ms < 60 * 1000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / 60000)}m ago`
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return minutes > 0 ? `${hours}h${minutes}m ago` : `${hours}h ago`
}

export default function ExecutionTimeline({ runs }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(interval)
  }, [])

  const rows = buildTimelineRows(runs, now)
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-text-muted text-xs">
        No recent executions
      </div>
    )
  }

  const windowMs = Math.max(now - Math.min(...rows.map(row => row.start)), 30 * 60 * 1000)
  const windowStart = now - windowMs
  const legend = new Set(['COMPLETED', 'FAILED', 'RUNNING', 'SKIPPED'])
  rows.forEach(row => row.segments.forEach(segment => legend.add(segment.status)))
  const legendItems = [...new Map([...legend].map(status => {
    const appearance = TIMELINE_STATUSES[status] || TIMELINE_STATUSES.UNKNOWN
    return [appearance.label, appearance]
  })).values()]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-text-secondary mb-1">
        {legendItems.map(({ label, color }) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
      {rows.map(row => (
        <div key={row.runId} className="flex items-center gap-2 h-7">
          <span className="text-xs text-text-muted w-24 truncate shrink-0" title={`${row.name} · ${row.device}`}>
            {row.name}
          </span>
          <div className="flex-1 h-5 bg-surface rounded relative overflow-hidden">
            {row.segments.map(segment => {
              const appearance = TIMELINE_STATUSES[segment.status] || TIMELINE_STATUSES.UNKNOWN
              const label = [row.name, row.device, segment.name !== row.name && segment.name, appearance.label, formatDuration(segment.duration)]
                .filter(Boolean).join(' · ')
              return (
                <div
                  key={segment.key}
                  role="img"
                  aria-label={label}
                  title={label}
                  className="absolute h-full min-w-[2px] rounded-sm border-r border-surface/50 transition-all duration-300"
                  style={{
                    left: `${((segment.start - windowStart) / windowMs) * 100}%`,
                    width: `${((segment.end - segment.start) / windowMs) * 100}%`,
                    backgroundColor: appearance.color,
                    opacity: 0.85,
                  }}
                />
              )
            })}
          </div>
        </div>
      ))}
      <div className="flex justify-between text-[10px] text-text-dim ml-[104px]">
        <span>{formatTimeLabel(windowMs)}</span>
        <span>{formatTimeLabel(windowMs / 2)}</span>
        <span>now</span>
      </div>
    </div>
  )
}
