import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import StatusBadge from '@/components/shared/StatusBadge'
import TimeAgo from '@/components/shared/TimeAgo'
import EmptyState from '@/components/shared/EmptyState'
import {
  AlertTriangle,
  Smartphone,
  User,
  Zap,
  FileWarning,
  ChevronDown,
  ChevronRight,
  Eye,
  CalendarOff,
  CheckCircle,
  RotateCcw,
  ExternalLink,
  XCircle,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const ERROR_TYPES = [
  { key: 'execution', label: 'Execution Errors', icon: Zap, color: '#EF4444' },
  { key: 'account', label: 'Account Issues', icon: User, color: '#F59E0B' },
  { key: 'device', label: 'Device Errors', icon: Smartphone, color: '#8B5CF6' },
  { key: 'content', label: 'Content Issues', icon: FileWarning, color: '#3B82F6' },
]

const SEVERITY_STYLES = {
  CRITICAL: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
  ERROR: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
  WARNING: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
}

const GROUP_OPTIONS = ['type', 'device', 'account']

function classifyError(error) {
  if (error.deviceId || error.deviceUdid || error.source === 'device') return 'device'
  if (error.accountId || error.accountUsername || error.source === 'account') return 'account'
  if (error.contentId || error.source === 'content') return 'content'
  return 'execution'
}

function getSeverity(error) {
  if (error.severity) return error.severity
  if (error.status === 'FAILED' || error.type === 'CRITICAL') return 'CRITICAL'
  if (error.status === 'ERROR') return 'ERROR'
  return 'WARNING'
}

function ErrorCard({ error, onAction }) {
  const [expanded, setExpanded] = useState(false)
  const severity = getSeverity(error)
  const errorType = classifyError(error)
  const TypeIcon = ERROR_TYPES.find((t) => t.key === errorType)?.icon || AlertTriangle

  return (
    <div className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-lg overflow-hidden hover:border-[#222222] transition-colors">
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#111111] border border-[#1a1a1a] flex items-center justify-center shrink-0 mt-0.5">
            <TypeIcon className="w-3.5 h-3.5 text-[#A1A1AA]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Badge variant="outline" className={cn('text-[10px] font-medium border', SEVERITY_STYLES[severity] || SEVERITY_STYLES.WARNING)}>
                {severity}
              </Badge>
              <TimeAgo date={error.timestamp || error.startedAt || error.createdAt} className="text-[10px] text-[#52525B]" />
            </div>
            <p className="text-sm text-[#FAFAFA] mb-1">{error.error || error.message || error.lastError || 'Unknown error'}</p>
            <div className="flex items-center gap-3 text-xs text-[#52525B]">
              {(error.accountUsername || error.account) && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {error.accountUsername || error.account}
                </span>
              )}
              {(error.deviceName || error.deviceUdid) && (
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3 h-3" /> {error.deviceName || error.deviceUdid?.slice(0, 10)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1 ml-9">
          {errorType === 'account' && (
            <>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-[#A1A1AA]" asChild>
                <a href={`/accounts?id=${error.accountId}`}><Eye className="w-3 h-3 mr-1" /> View Account</a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-[#A1A1AA]"
                onClick={() => onAction('disable-scheduling', error)}
              >
                <CalendarOff className="w-3 h-3 mr-1" /> Disable Scheduling
              </Button>
            </>
          )}
          {errorType === 'device' && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-[#A1A1AA]" asChild>
              <a href={`/devices?id=${error.deviceId}`}><Eye className="w-3 h-3 mr-1" /> View Device</a>
            </Button>
          )}
          {errorType === 'execution' && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-[#A1A1AA]" asChild>
              <a href={`/execution-center?run=${error.id || error.runId}`}><Eye className="w-3 h-3 mr-1" /> View Run</a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-[#22C55E] hover:text-[#22C55E] hover:bg-[#22C55E]/10"
            onClick={() => onAction('resolve', error)}
          >
            <CheckCircle className="w-3 h-3 mr-1" /> Resolve
          </Button>
          {expanded ? (
            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-[#52525B] ml-auto" onClick={() => setExpanded(false)}>
              Collapse <ChevronDown className="w-3 h-3 ml-0.5" />
            </Button>
          ) : (
            (error.stackTrace || error.logs || error.details) && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-[#52525B] ml-auto" onClick={() => setExpanded(true)}>
                Details <ChevronRight className="w-3 h-3 ml-0.5" />
              </Button>
            )
          )}
        </div>
      </div>

      {expanded && (error.stackTrace || error.logs || error.details) && (
        <div className="px-3 pb-3 ml-9">
          <pre className="text-[10px] text-[#A1A1AA] bg-[#111111] border border-[#1a1a1a] rounded-md p-2 overflow-x-auto max-h-40 whitespace-pre-wrap font-mono">
            {error.stackTrace || error.logs || error.details}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function ErrorCenter() {
  const queryClient = useQueryClient()
  const [filterType, setFilterType] = useState(null)
  const [groupBy, setGroupBy] = useState('type')
  const [showResolved, setShowResolved] = useState(false)

  const { data: runs = [], isLoading: loadingRuns } = useQuery({
    queryKey: ['error-runs'],
    queryFn: () => apiGet('/api/automation/runs?limit=50'),
    select: (res) => {
      const raw = res.data || res || {}
      const list = Array.isArray(raw) ? raw : (raw.runs || [])
      return list.filter((r) => r.status === 'FAILED' || r.status === 'ERROR')
    },
  })

  const { data: healthOverview = [] } = useQuery({
    queryKey: ['health-overview'],
    queryFn: () => apiGet('/api/accounts/health/overview'),
    select: (res) => {
      const list = res.data || res || []
      return Array.isArray(list) ? list.filter((a) => (a.score ?? a.healthScore ?? 100) < 50) : []
    },
  })

  const { data: devices = [] } = useQuery({
    queryKey: ['devices-errors'],
    queryFn: () => apiGet('/api/devices/live-status'),
    select: (res) => {
      const list = res.data || res || []
      return Array.isArray(list) ? list.filter((d) => d.status === 'ERROR') : []
    },
  })

  // Combine all errors into a unified list
  const allErrors = useMemo(() => {
    const errors = []

    runs.forEach((r) => {
      errors.push({
        ...r,
        source: 'execution',
        timestamp: r.startedAt || r.createdAt,
        error: r.error || r.message || 'Execution failed',
      })
    })

    healthOverview.forEach((a) => {
      errors.push({
        id: `health-${a.id}`,
        source: 'account',
        accountId: a.id,
        accountUsername: a.username,
        error: `Low health score: ${a.score ?? a.healthScore ?? 0}`,
        severity: (a.score ?? a.healthScore ?? 0) < 25 ? 'CRITICAL' : 'WARNING',
        timestamp: a.lastChecked || a.updatedAt,
      })
    })

    devices.forEach((d) => {
      errors.push({
        id: `device-${d.id}`,
        source: 'device',
        deviceId: d.id || d.deviceUdid,
        deviceName: d.deviceName || d.name || d.label,
        deviceUdid: d.deviceUdid || d.udid,
        error: d.lastError || 'Device in error state',
        severity: 'ERROR',
        timestamp: d.lastErrorAt || d.updatedAt,
      })
    })

    errors.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    return errors
  }, [runs, healthOverview, devices])

  const [resolvedIds, setResolvedIds] = useState(new Set())

  const activeErrors = useMemo(() => allErrors.filter((e) => !resolvedIds.has(e.id)), [allErrors, resolvedIds])
  const resolvedErrors = useMemo(() => allErrors.filter((e) => resolvedIds.has(e.id)), [allErrors, resolvedIds])

  const filteredErrors = useMemo(() => {
    if (!filterType) return activeErrors
    return activeErrors.filter((e) => classifyError(e) === filterType)
  }, [activeErrors, filterType])

  const grouped = useMemo(() => {
    const groups = {}
    filteredErrors.forEach((e) => {
      let key
      switch (groupBy) {
        case 'device': key = e.deviceName || e.deviceUdid || 'Unknown Device'; break
        case 'account': key = e.accountUsername || e.account || 'Unknown Account'; break
        default: key = classifyError(e); break
      }
      if (!groups[key]) groups[key] = []
      groups[key].push(e)
    })
    return groups
  }, [filteredErrors, groupBy])

  const typeCounts = useMemo(() => {
    const counts = {}
    ERROR_TYPES.forEach((t) => { counts[t.key] = 0 })
    activeErrors.forEach((e) => {
      const type = classifyError(e)
      counts[type] = (counts[type] || 0) + 1
    })
    return counts
  }, [activeErrors])

  const handleAction = (action, error) => {
    if (action === 'resolve') {
      setResolvedIds((prev) => new Set([...prev, error.id]))
      toast.success('Marked as resolved')
    } else if (action === 'disable-scheduling' && error.accountId) {
      apiPut(`/api/accounts/${error.accountId}/scheduling`, { enabled: false })
        .then(() => toast.success('Scheduling disabled'))
        .catch(() => toast.error('Failed to disable scheduling'))
    }
  }

  const isLoading = loadingRuns

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#FAFAFA]">Error Center</h1>
        <p className="text-sm text-[#52525B] mt-0.5">{activeErrors.length} active error{activeErrors.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Error summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ERROR_TYPES.map((type) => (
          <button
            key={type.key}
            onClick={() => setFilterType(filterType === type.key ? null : type.key)}
            className={cn(
              'bg-[#0A0A0A] border rounded-lg p-3 text-left transition-all',
              filterType === type.key ? 'border-[#3B82F6]/30 bg-[#3B82F6]/5' : 'border-[#1a1a1a] hover:border-[#222222]'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <type.icon className="w-3.5 h-3.5" style={{ color: type.color }} />
              <span className="text-xs text-[#52525B]">{type.label}</span>
            </div>
            <p className="text-lg font-semibold" style={{ color: type.color }}>{typeCounts[type.key] || 0}</p>
          </button>
        ))}
      </div>

      {/* Group by selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#52525B]">Group by:</span>
        {GROUP_OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => setGroupBy(opt)}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize',
              groupBy === opt ? 'bg-[#3B82F6]/10 text-[#3B82F6]' : 'text-[#52525B] hover:text-[#A1A1AA] hover:bg-[#111111]'
            )}
          >
            {opt}
          </button>
        ))}
      </div>

      {/* Error list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full bg-[#111111]" />
          ))}
        </div>
      ) : filteredErrors.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="No errors"
          description={filterType ? 'No errors in this category.' : 'All systems are operating normally.'}
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([group, errors]) => (
            <Collapsible key={group} defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1.5 group">
                <ChevronRight className="w-3.5 h-3.5 text-[#52525B] transition-transform group-data-[state=open]:rotate-90" />
                <span className="text-xs font-medium text-[#A1A1AA] capitalize">{group}</span>
                <Badge variant="outline" className="text-[10px] border-[#1a1a1a] text-[#52525B]">{errors.length}</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2 ml-5">
                {errors.map((error) => (
                  <ErrorCard key={error.id} error={error} onAction={handleAction} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Resolved errors */}
      {resolvedErrors.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 group">
            <ChevronRight className="w-3.5 h-3.5 text-[#52525B] transition-transform group-data-[state=open]:rotate-90" />
            <span className="text-xs font-medium text-[#52525B]">Resolved</span>
            <Badge variant="outline" className="text-[10px] border-[#1a1a1a] text-[#52525B]">{resolvedErrors.length}</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2 ml-5">
            {resolvedErrors.slice(0, 20).map((error) => (
              <div key={error.id} className="p-3 bg-[#0A0A0A] border border-[#1a1a1a] rounded-lg opacity-50">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span className="text-xs text-[#A1A1AA] flex-1 truncate">{error.error || error.message}</span>
                  <TimeAgo date={error.timestamp} className="text-[10px] text-[#52525B]" />
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
