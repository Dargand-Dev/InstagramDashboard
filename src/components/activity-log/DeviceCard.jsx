import { useMemo } from 'react'
import { formatDuration } from '@/utils/format'
import StatusBadge from '@/components/shared/StatusBadge'
import TimeAgo from '@/components/shared/TimeAgo'
import {
  Smartphone, Loader2, User, Clock, AlertTriangle, WifiOff,
  CheckCircle, XCircle, Minus,
} from 'lucide-react'

const STATUS_DOT = {
  IDLE: 'bg-[#22C55E]',
  RUNNING: 'bg-[#3B82F6] animate-subtle-pulse',
  ERROR: 'bg-[#EF4444]',
  OFFLINE: 'bg-[#52525B]',
  DISCONNECTED: 'bg-[#F59E0B] animate-subtle-pulse',
}

export default function DeviceCard({ device, activeRun, recentRuns, onClick }) {
  const statusColor = STATUS_DOT[device.status] || STATUS_DOT.OFFLINE
  const isRunning = device.status === 'RUNNING'
  const isError = device.status === 'ERROR'
  const isDisconnected = device.status === 'DISCONNECTED'

  const stats = useMemo(() => {
    const runs = recentRuns || []
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayRuns = runs.filter(r => {
      const t = r.startTime || r.startedAt || r.date
      return t && new Date(t) >= todayStart
    })

    const totalSuccess = runs.reduce((sum, r) => sum + (r.successCount || 0), 0)
    const totalFail = runs.reduce((sum, r) => sum + (r.failureCount || 0), 0)
    const totalAccounts = totalSuccess + totalFail

    return {
      runsToday: todayRuns.length,
      successCount: totalSuccess,
      successRate: totalAccounts > 0 ? Math.round((totalSuccess / totalAccounts) * 100) : 0,
    }
  }, [recentRuns])

  // Timeline: last 5 runs
  const timeline = (recentRuns || []).slice(0, 5)

  return (
    <div
      className={`group relative bg-[#0A0A0A] border rounded-lg p-4 hover:bg-[#111111] hover:border-[#222222] transition-all duration-150 cursor-pointer ${
        isError ? 'border-[#EF4444]/30' : isDisconnected ? 'border-[#F59E0B]/30' : 'border-[#1a1a1a]'
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#111111] border border-[#1a1a1a] flex items-center justify-center group-hover:bg-[#161616]">
            <Smartphone className="w-4 h-4 text-[#A1A1AA]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#FAFAFA]">{device.name || device.label || 'Unnamed Device'}</p>
            <p className="text-xs text-[#52525B] font-mono">{device.udid ? `${device.udid.slice(0, 12)}...` : '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-xs text-[#52525B]">{device.status || 'OFFLINE'}</span>
        </div>
      </div>

      {/* Mini-stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { label: 'Today', value: stats.runsToday, color: '#A1A1AA' },
          { label: 'Success', value: `${stats.successRate}%`, color: stats.successRate >= 80 ? '#22C55E' : stats.successRate >= 50 ? '#F59E0B' : '#EF4444' },
        ].map(s => (
          <div key={s.label} className="bg-[#111111] rounded-md px-2 py-1.5 text-center">
            <p className="text-[10px] text-[#52525B]">{s.label}</p>
            <p className="text-xs font-semibold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Live execution */}
      {isRunning && activeRun && (
        <div className="mb-3 p-2 rounded-md bg-[#3B82F6]/5 border border-[#3B82F6]/10">
          <div className="flex items-center gap-1.5 text-xs text-[#3B82F6] mb-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="font-medium truncate">{activeRun.workflowName || activeRun.currentAction || 'Running'}</span>
          </div>
          {activeRun.currentAccount && (
            <div className="flex items-center gap-1 text-xs text-[#A1A1AA]">
              <User className="w-3 h-3" />
              <span className="truncate">{activeRun.currentAccount}</span>
            </div>
          )}
          {activeRun.progress && (
            <div className="mt-1.5">
              <div className="h-1 rounded-full bg-[#1a1a1a] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#3B82F6] transition-all duration-300"
                  style={{ width: `${Math.round(((activeRun.progress.completed || 0) + (activeRun.progress.failed || 0)) / Math.max(1, activeRun.progress.completed + activeRun.progress.failed + (activeRun.progress.pending || 0) + (activeRun.progress.running || 0)) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-[#52525B] mt-0.5">
                {(activeRun.progress.completed || 0) + (activeRun.progress.failed || 0)}/{(activeRun.progress.completed || 0) + (activeRun.progress.failed || 0) + (activeRun.progress.pending || 0) + (activeRun.progress.running || 0)} accounts
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {isError && device.lastError && (
        <div className="mb-3 p-2 rounded-md bg-[#EF4444]/5 border border-[#EF4444]/10">
          <div className="flex items-center gap-1.5 text-xs text-[#EF4444]">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span className="truncate">{device.lastError}</span>
          </div>
        </div>
      )}

      {/* Disconnected */}
      {isDisconnected && (
        <div className="mb-3 p-2 rounded-md bg-[#F59E0B]/5 border border-[#F59E0B]/10">
          <div className="flex items-center gap-1.5 text-xs text-[#F59E0B]">
            <AlertTriangle className="w-3 h-3 shrink-0 animate-pulse" />
            <span className="font-medium">USB cable disconnected</span>
          </div>
          {device.currentAction && (
            <p className="text-xs text-[#A1A1AA] mt-0.5">{device.currentAction}</p>
          )}
        </div>
      )}

      {/* Mini-timeline */}
      {timeline.length > 0 && !isRunning && (
        <div className="space-y-1">
          {timeline.slice(0, 3).map((run, i) => {
            const status = (run.status || '').toUpperCase()
            const ok = status === 'SUCCESS' || ((run.successCount || 0) > 0 && (run.failureCount || 0) === 0)
            const fail = status === 'FAILED' || status === 'ERROR'
            return (
              <div key={run.runId || i} className="flex items-center gap-2 text-xs">
                {ok ? <CheckCircle className="w-3 h-3 text-[#22C55E] shrink-0" /> :
                 fail ? <XCircle className="w-3 h-3 text-[#EF4444] shrink-0" /> :
                 <Minus className="w-3 h-3 text-[#52525B] shrink-0" />}
                <span className="text-[#A1A1AA] truncate flex-1">{run.workflowType || run.workflowName || 'Run'}</span>
                <TimeAgo date={run.startTime || run.startedAt} className="text-[#52525B] shrink-0" />
              </div>
            )
          })}
        </div>
      )}

      {/* Offline state */}
      {device.status === 'OFFLINE' && timeline.length === 0 && (
        <div className="flex items-center gap-1.5 text-xs text-[#52525B]">
          <WifiOff className="w-3 h-3" />
          <span>Offline</span>
        </div>
      )}
    </div>
  )
}
