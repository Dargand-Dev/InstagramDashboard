import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '@/lib/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Collapsible } from '@/components/ui/collapsible'
import StatusBadge from '@/components/shared/StatusBadge'
import TimeAgo from '@/components/shared/TimeAgo'
import EmptyState from '@/components/shared/EmptyState'
import {
  Users,
  Activity,
  Film,
  Clock,
  Play,
  Square,
  ChevronRight,
  AlertTriangle,
  CircleDot,
  ArrowRight,
  Timer,
  Zap,
} from 'lucide-react'

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
  return <span className="text-xs text-[#A1A1AA] tabular-nums">{formatDuration(elapsed)}</span>
}

function MetricCard({ icon: Icon, label, value, subtitle, loading, color = '#3B82F6', children }) {
  if (loading) {
    return (
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardContent className="p-4">
          <Skeleton className="h-4 w-24 bg-[#1a1a1a] mb-3" />
          <Skeleton className="h-7 w-16 bg-[#1a1a1a] mb-1" />
          <Skeleton className="h-3 w-32 bg-[#1a1a1a]" />
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="bg-[#111111] border-[#1a1a1a]">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
          <span className="text-xs text-[#52525B] uppercase tracking-wider font-medium">{label}</span>
        </div>
        <div className="text-2xl font-semibold text-[#FAFAFA] mb-1">{value}</div>
        {subtitle && <p className="text-xs text-[#52525B]">{subtitle}</p>}
        {children}
      </CardContent>
    </Card>
  )
}

function ActiveRunCard({ run, onStop }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a] group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center shrink-0">
          <Play className="w-3.5 h-3.5 text-[#3B82F6]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#FAFAFA] truncate">{run.workflowName || run.workflow}</span>
            <StatusBadge status="RUNNING" />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[#52525B]">{run.deviceName || run.device}</span>
            <span className="text-xs text-[#3f3f46]">·</span>
            <ElapsedTime startedAt={run.startedAt} />
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-[#52525B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onStop(run.runId || run.id)}
        aria-label="Stop run"
      >
        <Square className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}

function RecentRunRow({ run }) {
  const [expanded, setExpanded] = useState(false)
  const results = run.results || run.accountResults || []
  const successCount = results.filter(r => r.status === 'SUCCESS' || r.success).length
  const failCount = results.filter(r => r.status === 'FAILED' || r.status === 'ERROR' || r.failed).length

  return (
    <div className="border-b border-[#1a1a1a] last:border-0">
      <button
        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-[#111111] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#FAFAFA]">{run.workflowName || run.trigger || run.workflow}</span>
            <StatusBadge status={run.status} />
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {(successCount > 0 || failCount > 0) && (
            <div className="flex items-center gap-2 text-xs">
              {successCount > 0 && <span className="text-[#22C55E]">{successCount} ok</span>}
              {failCount > 0 && <span className="text-[#EF4444]">{failCount} fail</span>}
            </div>
          )}
          <span className="text-xs text-[#52525B] tabular-nums w-14 text-right">{formatDuration(run.duration)}</span>
          <TimeAgo date={run.startedAt || run.date} className="text-xs text-[#52525B] w-16 text-right" />
          <ChevronRight className={`w-3.5 h-3.5 text-[#3f3f46] transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>
      {expanded && results.length > 0 && (
        <div className="px-4 pb-3">
          <div className="rounded-lg border border-[#1a1a1a] bg-[#0A0A0A] divide-y divide-[#1a1a1a]">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="text-[#A1A1AA]">{r.accountName || r.account || `Account ${i + 1}`}</span>
                <div className="flex items-center gap-2">
                  {r.failureReason && <span className="text-[#EF4444] truncate max-w-[200px]">{r.failureReason}</span>}
                  <StatusBadge status={r.status || (r.success ? 'SUCCESS' : 'FAILED')} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { subscribe, isConnected } = useWebSocket()

  // Data queries
  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts-active'],
    queryFn: () => apiGet('/api/accounts?status=ACTIVE'),
  })

  const { data: allAccountsData } = useQuery({
    queryKey: ['accounts-all'],
    queryFn: () => apiGet('/api/accounts'),
  })

  const { data: lockStatus, isLoading: lockLoading } = useQuery({
    queryKey: ['lock-status'],
    queryFn: () => apiGet('/api/automation/lock-status'),
    refetchInterval: isConnected ? false : 10000,
  })

  const { data: contentStatus, isLoading: contentLoading } = useQuery({
    queryKey: ['content-status'],
    queryFn: () => apiGet('/api/automation/content-status'),
  })

  const { data: schedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['schedule'],
    queryFn: () => apiGet('/api/automation/schedule'),
  })

  const { data: activeRuns, isLoading: activeRunsLoading } = useQuery({
    queryKey: ['active-runs'],
    queryFn: () => apiGet('/api/automation/runs/active'),
    refetchInterval: isConnected ? false : 10000,
  })

  const { data: recentRuns, isLoading: recentRunsLoading } = useQuery({
    queryKey: ['recent-runs'],
    queryFn: () => apiGet('/api/automation/runs?limit=10'),
  })

  const { data: healthOverview } = useQuery({
    queryKey: ['health-overview'],
    queryFn: () => apiGet('/api/accounts/health/overview'),
  })

  // WebSocket live updates for active runs
  useEffect(() => {
    if (!isConnected) return
    return subscribe('/topic/executions/status', () => {
      queryClient.invalidateQueries({ queryKey: ['active-runs'] })
      queryClient.invalidateQueries({ queryKey: ['recent-runs'] })
      queryClient.invalidateQueries({ queryKey: ['lock-status'] })
    })
  }, [isConnected, subscribe, queryClient])

  // Stop run mutation
  const stopMutation = useMutation({
    mutationFn: (runId) => apiPost(`/api/automation/runs/${runId}/stop`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['active-runs'] }),
  })

  // Derived data
  const activeAccounts = accountsData?.data || accountsData || []
  const allAccounts = allAccountsData?.data || allAccountsData || []
  const activeCount = Array.isArray(activeAccounts) ? activeAccounts.length : (activeAccounts?.count ?? 0)
  const totalCount = Array.isArray(allAccounts) ? allAccounts.length : (allAccounts?.total ?? 0)

  const lock = lockStatus?.data || lockStatus || {}
  const isRunning = lock.locked || lock.status === 'RUNNING'

  const content = contentStatus?.data || contentStatus || {}
  const totalReels = content.totalReels ?? content.total ?? Object.values(content.identities || {}).reduce((sum, v) => sum + (v.reelCount || v.count || 0), 0)

  const sched = schedule?.data || schedule || {}
  const nextRunTime = sched.nextRun || sched.nextRunTime

  const activeRunsList = activeRuns?.data || activeRuns || []
  const recentRunsList = recentRuns?.data || recentRuns || []

  const health = healthOverview?.data || healthOverview || {}
  const statusCounts = health.statusCounts || health.byStatus || {}

  // Alert conditions
  const contentIdentities = content.identities || content.byIdentity || {}
  const lowStockIdentities = Object.entries(contentIdentities).filter(
    ([, v]) => v.status === 'LOW_STOCK' || v.status === 'EMPTY' || (v.reelCount || v.count || 0) < 3
  )
  const lowHealthAccounts = health.lowHealthCount ?? (health.accounts || []).filter(a => (a.healthScore || 100) < 50).length

  const showAlert = lowStockIdentities.length > 0 || lowHealthAccounts > 0

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Dashboard</h1>

      {/* Alert Banner */}
      {showAlert && (
        <div className="rounded-lg border border-[#F59E0B]/20 bg-[#F59E0B]/5 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-[#F59E0B] mt-0.5 shrink-0" />
          <div className="space-y-1">
            {lowStockIdentities.length > 0 && (
              <p className="text-sm text-[#F59E0B]">
                Low content stock: {lowStockIdentities.map(([name]) => name).join(', ')}
              </p>
            )}
            {lowHealthAccounts > 0 && (
              <p className="text-sm text-[#F59E0B]">
                {lowHealthAccounts} account{lowHealthAccounts > 1 ? 's' : ''} with health score below 50
              </p>
            )}
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Users}
          label="Active Accounts"
          value={activeCount}
          subtitle={totalCount > 0 ? `${Math.round((activeCount / totalCount) * 100)}% of ${totalCount} total` : undefined}
          loading={accountsLoading}
          color="#22C55E"
        >
          {totalCount > 0 && (
            <div className="mt-2 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#22C55E] transition-all duration-500"
                style={{ width: `${Math.round((activeCount / totalCount) * 100)}%` }}
              />
            </div>
          )}
        </MetricCard>

        <MetricCard
          icon={Activity}
          label="System Status"
          value={isRunning ? 'RUNNING' : 'IDLE'}
          subtitle={isRunning ? (lock.currentAction || lock.workflow || 'Processing...') : 'No active workflow'}
          loading={lockLoading}
          color={isRunning ? '#3B82F6' : '#52525B'}
        />

        <MetricCard
          icon={Film}
          label="Content Stock"
          value={totalReels}
          subtitle="Total reels across identities"
          loading={contentLoading}
          color="#8B5CF6"
        />

        <MetricCard
          icon={Clock}
          label="Next Run"
          value={nextRunTime ? <TimeAgo date={nextRunTime} className="text-2xl font-semibold text-[#FAFAFA]" /> : '—'}
          subtitle={sched.enabled === false ? 'Schedule disabled' : nextRunTime ? 'Scheduled' : 'No upcoming runs'}
          loading={scheduleLoading}
          color="#F59E0B"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active Executions + Recent Runs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Active Executions */}
          <Card className="bg-[#111111] border-[#1a1a1a]">
            <CardHeader>
              <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#3B82F6]" />
                Active Executions
                {Array.isArray(activeRunsList) && activeRunsList.length > 0 && (
                  <Badge variant="outline" className="bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20 text-xs ml-1">
                    {activeRunsList.length}
                  </Badge>
                )}
              </CardTitle>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#52525B] hover:text-[#A1A1AA]"
                  onClick={() => navigate('/execution-center')}
                >
                  View All <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {activeRunsLoading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <Skeleton key={i} className="h-16 bg-[#1a1a1a] rounded-lg" />)}
                </div>
              ) : Array.isArray(activeRunsList) && activeRunsList.length > 0 ? (
                <div className="space-y-2">
                  {activeRunsList.map((run) => (
                    <ActiveRunCard
                      key={run.runId || run.id}
                      run={run}
                      onStop={(id) => stopMutation.mutate(id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-[#52525B] text-sm">
                  <Timer className="w-4 h-4 mr-2" />
                  No active executions
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Runs */}
          <Card className="bg-[#111111] border-[#1a1a1a]">
            <CardHeader>
              <CardTitle className="text-sm text-[#A1A1AA]">Recent Runs</CardTitle>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#52525B] hover:text-[#A1A1AA]"
                  onClick={() => navigate('/activity-log')}
                >
                  View All <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="p-0">
              {recentRunsLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 bg-[#1a1a1a] rounded-lg" />)}
                </div>
              ) : Array.isArray(recentRunsList) && recentRunsList.length > 0 ? (
                <div className="divide-y divide-[#1a1a1a]">
                  {recentRunsList.map((run, i) => (
                    <RecentRunRow key={run.runId || run.id || i} run={run} />
                  ))}
                </div>
              ) : (
                <EmptyState title="No recent runs" description="Run history will appear here" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: System Health */}
        <div className="space-y-4">
          {/* Account Health */}
          <Card className="bg-[#111111] border-[#1a1a1a]">
            <CardHeader>
              <CardTitle className="text-sm text-[#A1A1AA]">Account Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Active', count: statusCounts.ACTIVE || statusCounts.active || 0, color: '#22C55E' },
                  { label: 'Suspended', count: statusCounts.SUSPENDED || statusCounts.suspended || 0, color: '#F59E0B' },
                  { label: 'Banned', count: statusCounts.BANNED || statusCounts.banned || 0, color: '#EF4444' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CircleDot className="w-3 h-3" style={{ color }} />
                      <span className="text-sm text-[#A1A1AA]">{label}</span>
                    </div>
                    <span className="text-sm font-medium text-[#FAFAFA] tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Content Stock by Identity */}
          <Card className="bg-[#111111] border-[#1a1a1a]">
            <CardHeader>
              <CardTitle className="text-sm text-[#A1A1AA]">Content Stock</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(contentIdentities).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(contentIdentities).map(([name, data]) => {
                    const count = data.reelCount || data.count || 0
                    const max = Math.max(...Object.values(contentIdentities).map(d => d.reelCount || d.count || 0), 1)
                    return (
                      <div key={name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#A1A1AA] truncate">{name}</span>
                          <span className="text-xs text-[#52525B] tabular-nums">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(count / max) * 100}%`,
                              background: count < 3 ? '#EF4444' : count < 10 ? '#F59E0B' : '#8B5CF6',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#52525B] text-center py-4">No content data</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
