import { useEffect, useRef } from 'react'
import { Loader2, CheckCircle, XCircle, SkipForward, Container, Radio, Trash2 } from 'lucide-react'
import Card from './Card'
import StatusBadge from './StatusBadge'
import { useWorkflowLogs } from '../hooks/useWorkflowLogs'

export const STEP_ICON = {
  RUNNING: <Loader2 size={12} className="animate-spin text-blue-400" />,
  SUCCESS: <CheckCircle size={12} className="text-emerald-400" />,
  FAILED: <XCircle size={12} className="text-red-400" />,
  SKIPPED: <SkipForward size={12} className="text-[#555]" />,
  BATCH_PROGRESS: <Container size={12} className="text-orange-400" />,
  COMPLETE: <CheckCircle size={12} className="text-emerald-400" />,
}

export function formatDuration(ms) {
  if (!ms) return '—'
  if (typeof ms === 'string') return ms
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

export function deriveOverallStatus(events, completed, connected) {
  if (!completed) return connected ? 'RUNNING' : 'PENDING'
  const completeMsg = events.find(e => e.status === 'COMPLETE')?.message || ''
  if (completeMsg.includes('SUCCESS')) return 'SUCCESS'
  if (completeMsg.includes('ABORTED') || completeMsg.includes('FAILED') || completeMsg.includes('ERROR')) return 'FAILED'
  return 'PARTIAL'
}

export function WorkflowEventRow({ evt }) {
  return (
    <div className={`flex items-start gap-2 text-xs px-2 py-1.5 rounded-md ${
      evt.status === 'FAILED' ? 'bg-red-500/5 border border-red-500/10' :
      evt.status === 'BATCH_PROGRESS' ? 'bg-orange-500/5 border border-orange-500/10' :
      evt.status === 'COMPLETE' ? 'bg-emerald-500/5 border border-emerald-500/10' :
      'bg-[#060606]'
    }`}>
      <div className="mt-0.5 shrink-0">{STEP_ICON[evt.status] || STEP_ICON.RUNNING}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {evt.stepName && (
            <span className="text-white font-medium">{evt.stepName}</span>
          )}
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
  )
}

export default function LogStreamCard({ run, onRemove }) {
  const { events, connected, completed } = useWorkflowLogs(run.runId)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events])

  const overallStatus = deriveOverallStatus(events, completed, connected)

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {connected && !completed && <Radio size={10} className="text-blue-400 animate-pulse" />}
          <h3 className="text-white font-bold text-sm">{run.workflowName}</h3>
          <span className="text-[10px] text-[#333] font-mono">{run.runId}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={overallStatus} />
          {completed && onRemove && (
            <button onClick={() => onRemove(run.runId)}
              className="text-[#333] hover:text-red-400 transition-colors p-1">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
      <div ref={scrollRef} className="max-h-[300px] overflow-y-auto space-y-1">
        {events.length === 0 ? (
          <p className="text-xs text-[#333] py-2">Waiting for events...</p>
        ) : (
          events.map((evt, i) => <WorkflowEventRow key={i} evt={evt} />)
        )}
      </div>
    </Card>
  )
}
