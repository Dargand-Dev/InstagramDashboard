import { useState, useMemo, useEffect } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { formatDuration } from '@/utils/format'
import { useActiveRuns } from '@/hooks/useActiveRuns'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import RunRow from '../RunRow'
import {
  ScrollText, Loader2, StopCircle, User, CheckCircle, XCircle, Clock,
  ChevronLeft, ChevronRight, Terminal,
} from 'lucide-react'
import { toast } from 'sonner'
import RunLogModal from '../RunLogModal'

const PAGE_SIZE = 20

export default function DeviceRunsTab({ device }) {
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(0)
  const [retryingId, setRetryingId] = useState(null)
  const [stopping, setStopping] = useState(false)
  const [logsModalOpen, setLogsModalOpen] = useState(false)

  const { activeRuns } = useActiveRuns()
  const deviceActiveRun = activeRuns.find(r => (r.deviceUdid || r.device) === device.udid)

  // Reset page when device or filter changes
  useEffect(() => { setPage(0) }, [device.udid, typeFilter])

  const { data: runsResponse = {}, isLoading } = useQuery({
    queryKey: ['device-runs', device.udid, page],
    queryFn: () => apiGet(`/api/automation/runs?deviceUdid=${encodeURIComponent(device.udid)}&limit=${PAGE_SIZE}&page=${page}`),
    select: res => {
      const raw = res.data || res || {}
      if (Array.isArray(raw)) return { runs: raw, totalRuns: raw.length, totalPages: 1 }
      return {
        runs: raw.runs || [],
        totalRuns: raw.totalRuns || 0,
        totalPages: raw.totalPages || 1,
      }
    },
    placeholderData: keepPreviousData,
    staleTime: 30000,
    enabled: !!device.udid,
  })

  const runs = runsResponse.runs || []
  const totalRuns = runsResponse.totalRuns || 0
  const totalPages = runsResponse.totalPages || 1

  const workflowTypes = useMemo(() => {
    const set = new Set(runs.map(r => r.workflowType || r.workflowName).filter(Boolean))
    return [...set]
  }, [runs])

  const filtered = useMemo(() => {
    if (!typeFilter) return runs
    return runs.filter(r => (r.workflowType || r.workflowName) === typeFilter)
  }, [runs, typeFilter])

  async function handleRetry(run, failedAccounts) {
    const runId = run.runId || run.id
    setRetryingId(runId)
    try {
      await apiPost('/api/automation/trigger', { usernames: failedAccounts })
      toast.success(`Retry triggered for ${failedAccounts.length} account(s)`)
    } catch (err) {
      toast.error(err.message || 'Retry failed')
    } finally {
      setRetryingId(null)
    }
  }

  async function handleStop() {
    if (!deviceActiveRun?.runId) return
    setStopping(true)
    try {
      await apiPost(`/api/automation/runs/${deviceActiveRun.runId}/stop`, { mode: 'GRACEFUL' })
      toast.success('Stop requested')
    } catch (err) {
      toast.error(err.message || 'Failed to stop')
    } finally {
      setStopping(false)
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Active run */}
      {deviceActiveRun && (
        <div className="rounded-lg border border-[#3B82F6]/20 bg-[#3B82F6]/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-[#3B82F6] animate-spin" />
              <span className="text-sm font-medium text-[#FAFAFA]">{deviceActiveRun.workflowName || 'Running'}</span>
              <StatusBadge status="RUNNING" />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10"
                onClick={() => setLogsModalOpen(true)}
              >
                <Terminal className="w-3 h-3 mr-1" />
                Logs
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                onClick={handleStop}
                disabled={stopping}
              >
                <StopCircle className="w-3 h-3 mr-1" />
                {stopping ? 'Stopping...' : 'Stop'}
              </Button>
            </div>
          </div>

          {deviceActiveRun.elapsedSeconds && (
            <div className="flex items-center gap-1 text-xs text-[#52525B]">
              <Clock className="w-3 h-3" />
              <span>{formatDuration(deviceActiveRun.elapsedSeconds * 1000)}</span>
            </div>
          )}

          {/* Per-account progress */}
          {deviceActiveRun.accountEntries && (
            <div className="space-y-1">
              {deviceActiveRun.accountEntries.map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-[#52525B]" />
                    <span className="text-[#A1A1AA]">{entry.username || entry.account || `Account ${i + 1}`}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {entry.status === 'SUCCESS' || entry.status === 'COMPLETED' ? (
                      <CheckCircle className="w-3 h-3 text-[#22C55E]" />
                    ) : entry.status === 'FAILED' || entry.status === 'ERROR' ? (
                      <XCircle className="w-3 h-3 text-[#EF4444]" />
                    ) : entry.status === 'RUNNING' || entry.status === 'IN_PROGRESS' ? (
                      <Loader2 className="w-3 h-3 text-[#3B82F6] animate-spin" />
                    ) : (
                      <span className="w-3 h-3 rounded-full bg-[#1a1a1a]" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Progress bar */}
          {deviceActiveRun.progress && (
            <div>
              <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#3B82F6] transition-all duration-300"
                  style={{
                    width: `${Math.round(
                      ((deviceActiveRun.progress.completed || 0) + (deviceActiveRun.progress.failed || 0)) /
                      Math.max(1, (deviceActiveRun.progress.completed || 0) + (deviceActiveRun.progress.failed || 0) + (deviceActiveRun.progress.pending || 0) + (deviceActiveRun.progress.running || 0)) * 100
                    )}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter pills */}
      {workflowTypes.length > 1 && (
        <div className="flex items-center bg-[#0A0A0A] rounded-lg border border-[#1a1a1a] p-0.5 w-fit">
          <button
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${!typeFilter ? 'bg-[#1a1a1a] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'}`}
            onClick={() => setTypeFilter('')}
          >
            All
          </button>
          {workflowTypes.map(t => (
            <button
              key={t}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${typeFilter === t ? 'bg-[#1a1a1a] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'}`}
              onClick={() => setTypeFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Past runs */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full bg-[#111111]" />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="rounded-lg border border-[#1a1a1a] bg-[#111111] divide-y divide-[#1a1a1a]">
          {filtered.map((run, i) => (
            <RunRow key={run.runId || run.id || i} run={run} onRetry={handleRetry} retryingId={retryingId} />
          ))}
        </div>
      ) : (
        <EmptyState icon={ScrollText} title="No runs" description="No execution history for this device." />
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-[#52525B]">
            {totalRuns} run(s)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[#A1A1AA]"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-[#52525B]">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[#A1A1AA]"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {logsModalOpen && deviceActiveRun?.runId && (
        <RunLogModal
          runId={deviceActiveRun.runId}
          open={logsModalOpen}
          onClose={() => setLogsModalOpen(false)}
        />
      )}
    </div>
  )
}
