import { useEffect, useRef, useMemo } from 'react'
import { Radio } from 'lucide-react'
import Card from './Card'
import StatusBadge from './StatusBadge'
import { useWorkflowLogs } from '../hooks/useWorkflowLogs'
import { WorkflowEventRow, deriveOverallStatus } from './LogStreamCard'

function LiveRunStream({ runId, workflowName }) {
  const { events, connected, completed } = useWorkflowLogs(runId)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events])

  const { visibleEvents, progress, successSteps, failedSteps, overallStatus } = useMemo(() => {
    const visible = events.slice(-20)
    const batchEvents = events.filter(e => e.status === 'BATCH_PROGRESS')
    const lastBatch = batchEvents[batchEvents.length - 1]

    return {
      visibleEvents: visible,
      progress: lastBatch
        ? { current: lastBatch.containerIndex + 1, total: lastBatch.totalContainers, name: lastBatch.containerName }
        : null,
      successSteps: events.filter(e => e.status === 'SUCCESS').length,
      failedSteps: events.filter(e => e.status === 'FAILED').length,
      overallStatus: deriveOverallStatus(events, completed, connected),
    }
  }, [events, completed, connected])

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

      {progress && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-white font-medium">{progress.name}</span>
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

      <div ref={scrollRef} className="max-h-[200px] overflow-y-auto space-y-1">
        {visibleEvents.length === 0 ? (
          <p className="text-xs text-[#333] py-2">Waiting for events...</p>
        ) : (
          visibleEvents.map((evt, i) => <WorkflowEventRow key={i} evt={evt} />)
        )}
      </div>
    </Card>
  )
}

export default function LiveExecutionPanel({ activeRuns }) {
  if (!activeRuns || activeRuns.length === 0) return null

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
