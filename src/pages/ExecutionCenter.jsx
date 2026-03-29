import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Collapsible } from '@/components/ui/collapsible'
import StatusBadge from '@/components/shared/StatusBadge'
import LogViewer from '@/components/shared/LogViewer'
import TimeAgo from '@/components/shared/TimeAgo'
import EmptyState from '@/components/shared/EmptyState'
import {
  Zap,
  Square,
  SkullIcon,
  ChevronDown,
  ChevronUp,
  Search,
  Play,
  Clock,
  Loader2,
  ArrowRight,
  Timer,
  ListOrdered,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
} from 'recharts'

function formatDuration(ms) {
  if (!ms) return '—'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return `${m}m ${rem}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function ElapsedTime({ startedAt }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startedAt) return
    const start = new Date(startedAt).getTime()
    const tick = () => setElapsed(Date.now() - start)
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return <span className="tabular-nums">{formatDuration(elapsed)}</span>
}

const STATUS_COLORS = {
  RUNNING: '#3B82F6',
  COMPLETED: '#22C55E',
  SUCCESS: '#22C55E',
  FAILED: '#EF4444',
  ERROR: '#EF4444',
  QUEUED: '#8B5CF6',
}

function ExecutionTimeline({ runs }) {
  const now = Date.now()
  const thirtyMinAgo = now - 30 * 60 * 1000

  const chartData = (runs || []).map((run) => {
    const start = new Date(run.startedAt).getTime()
    const end = run.completedAt ? new Date(run.completedAt).getTime() : now
    return {
      name: run.workflowName || run.workflow || 'Run',
      start: Math.max(start, thirtyMinAgo),
      end: Math.min(end, now),
      duration: end - start,
      status: run.status || 'RUNNING',
      device: run.deviceName || run.device,
      runId: run.runId || run.id,
    }
  }).filter(d => d.end > thirtyMinAgo)

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-[#52525B] text-xs">
        No executions in the last 30 minutes
      </div>
    )
  }

  const data = chartData.map(d => ({
    ...d,
    offset: ((d.start - thirtyMinAgo) / (now - thirtyMinAgo)) * 100,
    width: ((d.end - d.start) / (now - thirtyMinAgo)) * 100,
  }))

  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={d.runId || i} className="group relative">
          <div className="flex items-center gap-2 h-7">
            <span className="text-xs text-[#52525B] w-24 truncate shrink-0">{d.name}</span>
            <div className="flex-1 h-5 bg-[#0A0A0A] rounded relative overflow-hidden">
              <div
                className="absolute h-full rounded transition-all duration-300"
                style={{
                  left: `${d.offset}%`,
                  width: `${Math.max(d.width, 1)}%`,
                  background: STATUS_COLORS[d.status] || '#52525B',
                  opacity: 0.8,
                }}
              />
            </div>
          </div>
          <div className="absolute left-28 top-0 hidden group-hover:flex items-center h-7 pointer-events-none z-10">
            <div className="bg-[#1a1a1a] border border-[#1a1a1a] rounded-md px-2 py-1 text-xs text-[#FAFAFA] shadow-lg whitespace-nowrap">
              {d.name} · {d.device} · {formatDuration(d.duration)}
            </div>
          </div>
        </div>
      ))}
      <div className="flex justify-between text-[10px] text-[#3f3f46] px-[104px]">
        <span>30m ago</span>
        <span>15m ago</span>
        <span>now</span>
      </div>
    </div>
  )
}

function ExecutionCard({ run, onStopGraceful, onKill }) {
  const [expanded, setExpanded] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [logText, setLogText] = useState('')
  const [killDialogOpen, setKillDialogOpen] = useState(false)
  const [accountSearch, setAccountSearch] = useState('')
  const eventSourceRef = useRef(null)

  const runId = run.runId || run.id
  const accounts = run.accounts || run.accountList || []
  const filteredAccounts = accounts.filter(a =>
    !accountSearch || (a.name || a.username || '').toLowerCase().includes(accountSearch.toLowerCase())
  )

  // SSE log stream
  useEffect(() => {
    if (!showLogs || !runId) return

    const es = new EventSource(`/api/automation/workflow/logs/stream?runId=${runId}`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      setLogText(prev => prev + event.data + '\n')
    }
    es.onerror = () => {
      es.close()
    }

    return () => es.close()
  }, [showLogs, runId])

  return (
    <Card className="bg-[#111111] border-[#1a1a1a]">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center shrink-0">
              <Play className="w-4 h-4 text-[#3B82F6]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#FAFAFA]">{run.workflowName || run.workflow}</span>
                <StatusBadge status={run.status || 'RUNNING'} />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-[#52525B]">{run.deviceName || run.device}</span>
                <span className="text-xs text-[#3f3f46]">·</span>
                <span className="text-xs text-[#A1A1AA]"><ElapsedTime startedAt={run.startedAt} /></span>
                {accounts.length > 0 && (
                  <>
                    <span className="text-xs text-[#3f3f46]">·</span>
                    <span className="text-xs text-[#52525B]">{accounts.length} accounts</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[#F59E0B] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10"
              onClick={() => onStopGraceful(runId)}
            >
              <Square className="w-3 h-3 mr-1.5" />
              Stop Gracefully
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
              onClick={() => setKillDialogOpen(true)}
            >
              <SkullIcon className="w-3 h-3 mr-1.5" />
              Kill
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[#52525B]"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="border-t border-[#1a1a1a]">
            {/* Account List */}
            {accounts.length > 0 && (
              <div className="p-4 border-b border-[#1a1a1a]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-[#52525B] uppercase tracking-wider font-medium">Accounts</span>
                  <div className="relative max-w-[200px]">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#52525B]" />
                    <Input
                      placeholder="Filter accounts..."
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                      className="pl-7 h-7 text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#3f3f46]"
                    />
                  </div>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {filteredAccounts.map((account, i) => (
                    <div key={account.id || i} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#0A0A0A]">
                      <span className="text-xs text-[#A1A1AA]">{account.name || account.username}</span>
                      <StatusBadge status={account.status || 'PENDING'} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Log Viewer Toggle */}
            <div className="p-4">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-[#52525B] hover:text-[#A1A1AA] mb-3"
                onClick={() => setShowLogs(!showLogs)}
              >
                {showLogs ? 'Hide Logs' : 'Show Logs'}
              </Button>
              {showLogs && (
                <LogViewer text={logText} height={300} />
              )}
            </div>
          </div>
        )}

        {/* Kill Confirmation Dialog */}
        <Dialog open={killDialogOpen} onOpenChange={setKillDialogOpen}>
          <DialogContent className="bg-[#111111] border-[#1a1a1a] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#FAFAFA]">Kill Execution?</DialogTitle>
              <DialogDescription className="text-[#52525B]">
                This will immediately terminate the execution. Any in-progress actions may leave accounts in an inconsistent state.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="ghost" className="text-[#A1A1AA]" />}>
                Cancel
              </DialogClose>
              <Button
                className="bg-[#EF4444] hover:bg-[#DC2626] text-white"
                onClick={() => {
                  onKill(runId)
                  setKillDialogOpen(false)
                }}
              >
                Kill Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

export default function ExecutionCenter() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { subscribe, isConnected } = useWebSocket()

  const { data: activeRuns, isLoading } = useQuery({
    queryKey: ['active-runs'],
    queryFn: () => apiGet('/api/automation/runs/active'),
    refetchInterval: 10000,
  })

  const { data: recentRuns } = useQuery({
    queryKey: ['recent-runs-timeline'],
    queryFn: () => apiGet('/api/automation/runs?limit=20'),
    refetchInterval: 10000,
  })

  const { data: queueData } = useQuery({
    queryKey: ['queue-preview'],
    queryFn: () => apiGet('/api/queue'),
  })

  // WebSocket
  useEffect(() => {
    if (!isConnected) return
    return subscribe('/topic/executions/status', () => {
      queryClient.invalidateQueries({ queryKey: ['active-runs'] })
      queryClient.invalidateQueries({ queryKey: ['recent-runs-timeline'] })
    })
  }, [isConnected, subscribe, queryClient])

  const stopGraceful = useMutation({
    mutationFn: (runId) => apiPost(`/api/automation/runs/${runId}/stop`, { mode: 'GRACEFUL' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['active-runs'] }),
  })

  const killImmediate = useMutation({
    mutationFn: (runId) => apiPost(`/api/automation/runs/${runId}/stop`, { mode: 'IMMEDIATE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['active-runs'] }),
  })

  const runs = activeRuns?.data || activeRuns || []
  const allRuns = recentRuns?.data || recentRuns || []
  const timelineRuns = [...(Array.isArray(runs) ? runs : []), ...(Array.isArray(allRuns) ? allRuns : [])]
    .filter((r, i, arr) => arr.findIndex(x => (x.runId || x.id) === (r.runId || r.id)) === i)

  const queue = queueData?.data || queueData || []

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Execution Center</h1>

      {/* Execution Timeline */}
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardHeader>
          <CardTitle className="text-sm text-[#A1A1AA]">Execution Timeline (last 30 min)</CardTitle>
        </CardHeader>
        <CardContent>
          <ExecutionTimeline runs={timelineRuns} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Active Executions */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[#A1A1AA] flex items-center gap-2">
              Active Executions
              {Array.isArray(runs) && runs.length > 0 && (
                <Badge variant="outline" className="bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20 text-xs">
                  {runs.length}
                </Badge>
              )}
            </h2>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-24 bg-[#111111] rounded-xl" />)}
            </div>
          ) : Array.isArray(runs) && runs.length > 0 ? (
            <div className="space-y-4">
              {runs.map((run) => (
                <ExecutionCard
                  key={run.runId || run.id}
                  run={run}
                  onStopGraceful={(id) => stopGraceful.mutate(id)}
                  onKill={(id) => killImmediate.mutate(id)}
                />
              ))}
            </div>
          ) : (
            <Card className="bg-[#111111] border-[#1a1a1a]">
              <CardContent className="p-0">
                <EmptyState
                  icon={Timer}
                  title="No active executions"
                  description="Trigger a workflow from the Actions page"
                  actionLabel="Go to Actions"
                  onAction={() => navigate('/actions')}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Queue Preview */}
        <div>
          <Card className="bg-[#111111] border-[#1a1a1a]">
            <CardHeader>
              <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
                <ListOrdered className="w-4 h-4" />
                Queue
              </CardTitle>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#52525B] hover:text-[#A1A1AA] h-7"
                  onClick={() => navigate('/queue')}
                >
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {Array.isArray(queue) && queue.length > 0 ? (
                <div className="space-y-2">
                  {queue.slice(0, 8).map((item, i) => (
                    <div key={item.id || i} className="flex items-center justify-between py-1.5">
                      <div className="min-w-0">
                        <span className="text-xs text-[#A1A1AA] truncate block">{item.action || item.workflow}</span>
                        <span className="text-[10px] text-[#3f3f46]">{item.accountName || item.account}</span>
                      </div>
                      <StatusBadge status={item.status || 'QUEUED'} />
                    </div>
                  ))}
                  {queue.length > 8 && (
                    <p className="text-[10px] text-[#3f3f46] text-center">+{queue.length - 8} more</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#52525B] text-center py-4">Queue empty</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
