import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import DataTable from '@/components/shared/DataTable'
import StatusBadge from '@/components/shared/StatusBadge'
import TimeAgo from '@/components/shared/TimeAgo'
import EmptyState from '@/components/shared/EmptyState'
import {
  ScrollText, Film, Trash2, ChevronRight, ChevronDown,
  Filter, X, RefreshCw,
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

function RunRow({ run }) {
  const [expanded, setExpanded] = useState(false)
  const results = run.results || run.accountResults || []
  const successCount = results.filter(r => r.status === 'SUCCESS' || r.success).length
  const failCount = results.filter(r => r.status === 'FAILED' || r.status === 'ERROR' || r.failed).length

  return (
    <div className="border-b border-[#1a1a1a] last:border-0">
      <button
        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-[#161616] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="shrink-0">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-[#52525B]" />
            : <ChevronRight className="w-3.5 h-3.5 text-[#52525B]" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#FAFAFA] font-medium">{run.workflowName || run.trigger || run.workflow || 'Run'}</span>
            <StatusBadge status={run.status} />
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-[#52525B]">
            <span>{run.triggerType || run.trigger || 'manual'}</span>
            {run.device && <span>{run.device}</span>}
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {(successCount > 0 || failCount > 0) && (
            <div className="flex items-center gap-2 text-xs">
              {successCount > 0 && <span className="text-[#22C55E]">{successCount} ok</span>}
              {failCount > 0 && <span className="text-[#EF4444]">{failCount} fail</span>}
            </div>
          )}
          <span className="text-xs text-[#52525B] tabular-nums w-16 text-right">{formatDuration(run.duration)}</span>
          <TimeAgo date={run.startedAt || run.date || run.createdAt} className="text-xs text-[#52525B] w-16 text-right" />
        </div>
      </button>
      {expanded && results.length > 0 && (
        <div className="px-4 pb-3 pl-12">
          <div className="rounded-lg border border-[#1a1a1a] bg-[#0A0A0A] divide-y divide-[#1a1a1a]">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="text-[#A1A1AA]">{r.accountName || r.account || r.username || `Account ${i + 1}`}</span>
                <div className="flex items-center gap-3">
                  {r.failureReason && (
                    <span className="text-[#EF4444] truncate max-w-[300px]">{r.failureReason}</span>
                  )}
                  <StatusBadge status={r.status || (r.success ? 'SUCCESS' : 'FAILED')} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {expanded && results.length === 0 && (
        <div className="px-4 pb-3 pl-12">
          <p className="text-xs text-[#52525B]">No account-level details available</p>
        </div>
      )}
    </div>
  )
}

function ContentCard({ name, data }) {
  const count = data.reelCount || data.count || (typeof data === 'number' ? data : 0)
  const accounts = data.accounts || data.accountNames || []
  const max = 50
  const pct = Math.min((count / max) * 100, 100)
  const color = count > 20 ? '#22C55E' : count >= 5 ? '#F59E0B' : '#EF4444'

  return (
    <Card className="bg-[#0A0A0A] border-[#1a1a1a]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#FAFAFA]">{name}</span>
          <Badge
            variant="outline"
            className="text-xs border"
            style={{ color, borderColor: `${color}33`, background: `${color}15` }}
          >
            {count} reels
          </Badge>
        </div>
        <div className="h-2 rounded-full bg-[#1a1a1a] overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
        {Array.isArray(accounts) && accounts.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {accounts.slice(0, 5).map(a => (
              <span key={a} className="text-xs text-[#52525B] bg-[#111111] px-2 py-0.5 rounded">{a}</span>
            ))}
            {accounts.length > 5 && (
              <span className="text-xs text-[#52525B]">+{accounts.length - 5} more</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function ActivityLog() {
  const [statusFilter, setStatusFilter] = useState('')
  const [triggerFilter, setTriggerFilter] = useState('')

  const { data: runsData, isLoading: runsLoading, refetch: refetchRuns } = useQuery({
    queryKey: ['runs'],
    queryFn: () => apiGet('/api/automation/runs?limit=50'),
    refetchInterval: 30000,
  })

  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ['content-status'],
    queryFn: () => apiGet('/api/automation/content-status'),
  })

  const { data: trashData, isLoading: trashLoading } = useQuery({
    queryKey: ['drive-trash'],
    queryFn: () => apiGet('/api/automation/drive/trash-queue'),
  })

  const runs = useMemo(() => {
    const raw = runsData?.data || runsData || []
    return Array.isArray(raw) ? raw : []
  }, [runsData])

  const filteredRuns = useMemo(() => {
    return runs.filter(r => {
      if (statusFilter && (r.status || '').toUpperCase() !== statusFilter) return false
      if (triggerFilter && (r.triggerType || r.trigger || '').toLowerCase() !== triggerFilter) return false
      return true
    })
  }, [runs, statusFilter, triggerFilter])

  const runStatuses = useMemo(() => {
    const set = new Set(runs.map(r => (r.status || '').toUpperCase()).filter(Boolean))
    return [...set]
  }, [runs])

  const triggerTypes = useMemo(() => {
    const set = new Set(runs.map(r => (r.triggerType || r.trigger || '').toLowerCase()).filter(Boolean))
    return [...set]
  }, [runs])

  const contentIdentities = useMemo(() => {
    const raw = contentData?.data || contentData || {}
    return raw.identities || raw.byIdentity || raw
  }, [contentData])

  const trashQueue = useMemo(() => {
    const raw = trashData?.data || trashData || []
    return Array.isArray(raw) ? raw : []
  }, [trashData])

  const trashColumns = useMemo(() => [
    {
      accessorKey: 'fileName',
      header: 'File',
      accessorFn: row => row.fileName || row.name || row.fileId,
      cell: ({ row }) => <span className="text-[#FAFAFA]">{row.original.fileName || row.original.name || row.original.fileId || '—'}</span>,
    },
    {
      accessorKey: 'identity',
      header: 'Identity',
      cell: ({ row }) => <span>{row.original.identity || '—'}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status || 'PENDING'} />,
    },
    {
      accessorKey: 'scheduledAt',
      header: 'Scheduled',
      accessorFn: row => row.scheduledAt || row.createdAt,
      cell: ({ row }) => <TimeAgo date={row.original.scheduledAt || row.original.createdAt} />,
    },
  ], [])

  const hasRunFilters = statusFilter || triggerFilter

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Activity Log</h1>

      <Tabs defaultValue="runs">
        <TabsList className="bg-[#0A0A0A] border border-[#1a1a1a]">
          <TabsTrigger value="runs" className="text-xs data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-[#FAFAFA]">
            <ScrollText className="w-3.5 h-3.5 mr-1.5" />
            Runs
            {runs.length > 0 && (
              <Badge variant="outline" className="ml-1.5 text-[10px] bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20">{runs.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="content" className="text-xs data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-[#FAFAFA]">
            <Film className="w-3.5 h-3.5 mr-1.5" />
            Content
          </TabsTrigger>
          <TabsTrigger value="trash" className="text-xs data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-[#FAFAFA]">
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Drive Trash
          </TabsTrigger>
        </TabsList>

        {/* Runs Tab */}
        <TabsContent value="runs" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {runStatuses.length > 0 && (
                <div className="flex items-center bg-[#0A0A0A] rounded-lg border border-[#1a1a1a] p-0.5">
                  <button
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${!statusFilter ? 'bg-[#1a1a1a] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'}`}
                    onClick={() => setStatusFilter('')}
                  >
                    All
                  </button>
                  {runStatuses.map(s => (
                    <button
                      key={s}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${statusFilter === s ? 'bg-[#1a1a1a] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'}`}
                      onClick={() => setStatusFilter(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {triggerTypes.length > 1 && (
                <div className="flex items-center bg-[#0A0A0A] rounded-lg border border-[#1a1a1a] p-0.5">
                  <button
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${!triggerFilter ? 'bg-[#1a1a1a] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'}`}
                    onClick={() => setTriggerFilter('')}
                  >
                    All Triggers
                  </button>
                  {triggerTypes.map(t => (
                    <button
                      key={t}
                      className={`px-2.5 py-1 text-xs rounded-md capitalize transition-colors ${triggerFilter === t ? 'bg-[#1a1a1a] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'}`}
                      onClick={() => setTriggerFilter(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
              {hasRunFilters && (
                <Button variant="ghost" size="xs" className="text-[#52525B] hover:text-[#A1A1AA]" onClick={() => { setStatusFilter(''); setTriggerFilter('') }}>
                  <X className="w-3 h-3 mr-1" />Clear
                </Button>
              )}
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-[#52525B] hover:text-[#A1A1AA]" onClick={() => refetchRuns()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>

          <Card className="bg-[#111111] border-[#1a1a1a]">
            <CardContent className="p-0">
              {runsLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full bg-[#1a1a1a]" />)}
                </div>
              ) : filteredRuns.length > 0 ? (
                <div className="divide-y divide-[#1a1a1a]">
                  {filteredRuns.map((run, i) => (
                    <RunRow key={run.runId || run.id || i} run={run} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={ScrollText} title="No runs found" description={hasRunFilters ? 'Try adjusting your filters' : 'Execution history will appear here'} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="mt-4">
          {contentLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 bg-[#1a1a1a] rounded-lg" />)}
            </div>
          ) : typeof contentIdentities === 'object' && Object.keys(contentIdentities).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(contentIdentities).map(([name, data]) => (
                <ContentCard key={name} name={name} data={data} />
              ))}
            </div>
          ) : (
            <Card className="bg-[#111111] border-[#1a1a1a]">
              <CardContent className="p-0">
                <EmptyState icon={Film} title="No content data" description="Identity content status will appear here" />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Drive Trash Tab */}
        <TabsContent value="trash" className="mt-4">
          <Card className="bg-[#111111] border-[#1a1a1a]">
            <CardContent className="p-4">
              {trashLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-[#1a1a1a]" />)}
                </div>
              ) : trashQueue.length > 0 ? (
                <DataTable
                  columns={trashColumns}
                  data={trashQueue}
                  pageSize={20}
                  searchable
                  searchPlaceholder="Search files..."
                />
              ) : (
                <EmptyState icon={Trash2} title="Trash queue empty" description="No pending drive deletions" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
