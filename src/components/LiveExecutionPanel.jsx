import { useEffect, useRef } from 'react'
import { Radio } from 'lucide-react'
import Card from './Card'
import StatusBadge from './StatusBadge'
import { useActiveRuns } from '../hooks/useActiveRuns'
import { useWorkflowLogs } from '../hooks/useWorkflowLogs'
import { STEP_ICON, formatDuration } from './LogStreamCard'

function LiveRunStream({ runId, workflowName }) {
  const { events, connected, completed } = useWorkflowLogs(runId)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events])

  const visibleEvents = events.slice(-20)

  // Derive batch progress
  const batchEvents = events.filter(e => e.status === 'BATCH_PROGRESS')
  const lastBatch = batchEvents[batchEvents.length - 1]
  const progress = lastBatch
    ? { current: lastBatch.containerIndex + 1, total: lastBatch.totalContainers, name: lastBatch.containerName }
    : null

  // Count successes / failures from step events
  const successSteps = events.filter(e => e.status === 'SUCCESS').length
  const failedSteps = events.filter(e => e.status === 'FAILED').length

  const overallStatus = completed
    ? (events.find(e => e.status === 'COMPLETE')?.message?.includes('SUCCESS') ? 'SUCCESS'
      : events.find(e => e.status === 'COMPLETE')?.message?.includes('FAILED') ? 'FAILED'
      : 'PARTIAL')
    : connected ? 'RUNNING' : 'PENDING'

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {connected && !completed && <Radio size={10} className="text-blue-400 animate-pulse" />}
          <h3 className="text-white font-bold text-sm">{workflowName}</h3>
          <span className="text-[10px] text-[#333] font-mono">{runId}</span>
        </div>
        <div className="flex items-center gap-3">
          {(successSteps > 0 || failedSteps > 0) && (
            <span className="text-[10px] font-mono">
              <span className="text-emerald-400">{successSteps}</span>
              <span className="text-[#333]"> / </span>
              <span className="text-red-400">{failedSteps}</span>
            </span>
          )}
          <StatusBadge status={overallStatus} />
        </div>
      </div>

      {/* Batch progress bar */}
      {progress && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-[#555]">
              <span className="text-white font-medium">{progress.name}</span>
            </span>
            <span className="text-[#555] font-mono">{progress.current}/{progress.total} accounts</span>
          </div>
          <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Event stream */}
      <div ref={scrollRef} className="max-h-[200px] overflow-y-auto space-y-1">
        {visibleEvents.length === 0 ? (
          <p className="text-xs text-[#333] py-2">Waiting for events...</p>
        ) : (
          visibleEvents.map((evt, i) => (
            <div key={i} className={`flex items-start gap-2 text-xs px-2 py-1.5 rounded-md ${
              evt.status === 'FAILED' ? 'bg-red-500/5 border border-red-500/10' :
              evt.status === 'BATCH_PROGRESS' ? 'bg-orange-500/5 border border-orange-500/10' :
              evt.status === 'COMPLETE' ? 'bg-emerald-500/5 border border-emerald-500/10' :
              'bg-[#060606]'
            }`}>
              <div className="mt-0.5 shrink-0">{STEP_ICON[evt.status] || STEP_ICON.RUNNING}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {evt.stepName && <span className="text-white font-medium">{evt.stepName}</span>}
                  {evt.totalSteps > 0 && evt.status !== 'BATCH_PROGRESS' && evt.status !== 'COMPLETE' && (
                    <span className="text-[#333] font-mono text-[10px]">[{evt.stepIndex + 1}/{evt.totalSteps}]</span>
                  )}
                  {evt.containerName && (
                    <span className="text-orange-400 font-mono text-[10px]">
                      {evt.containerName}{evt.totalContainers > 0 ? ` (${evt.containerIndex + 1}/${evt.totalContainers})` : ''}
                    </span>
                  )}
                  {evt.durationMs > 0 && (
                    <span className="text-[#333] font-mono text-[10px]">{formatDuration(evt.durationMs)}</span>
                  )}
                </div>
                {evt.message && <p className="text-[#555] text-[10px] mt-0.5 truncate">{evt.message}</p>}
                {evt.errorMessage && <p className="text-red-400/70 text-[10px] mt-0.5 truncate">{evt.errorMessage}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}

export default function LiveExecutionPanel() {
  const { activeRuns, hasActiveRuns } = useActiveRuns(4000)

  if (!hasActiveRuns) return null

  return (
    <div className="mb-6">
      <span className="label-upper block mb-3">Live Execution</span>
      <div className="space-y-3">
        {activeRuns.map(run => (
          <LiveRunStream key={run.runId} runId={run.runId} workflowName={run.workflowName} />
        ))}
      </div>
    </div>
  )
}
