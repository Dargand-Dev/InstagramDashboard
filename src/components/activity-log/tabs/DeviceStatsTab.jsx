import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { formatDuration } from '@/utils/format'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Minus, ScrollText, CheckCircle, Clock, Users } from 'lucide-react'

export default function DeviceStatsTab({ device }) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['device-runs', device.udid],
    queryFn: () => apiGet(`/api/automation/runs?deviceUdid=${encodeURIComponent(device.udid)}&limit=50`),
    select: res => {
      const raw = res.data || res || {}
      if (Array.isArray(raw)) return raw
      return raw.runs || []
    },
    staleTime: 30000,
    enabled: !!device.udid,
  })

  const stats = useMemo(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    const todayRuns = runs.filter(r => {
      const t = r.startTime || r.startedAt
      return t && new Date(t) >= todayStart
    })
    const yesterdayRuns = runs.filter(r => {
      const t = r.startTime || r.startedAt
      return t && new Date(t) >= yesterdayStart && new Date(t) < todayStart
    })

    const totalSuccess = runs.reduce((sum, r) => sum + (r.successCount || 0), 0)
    const totalFail = runs.reduce((sum, r) => sum + (r.failureCount || 0), 0)
    const totalAccounts = totalSuccess + totalFail
    const successRate = totalAccounts > 0 ? Math.round((totalSuccess / totalAccounts) * 100) : 0

    const completed = runs.filter(r => r.status)
    const avgDuration = completed.length > 0
      ? completed.reduce((sum, r) => sum + (r.durationMs || r.duration || 0), 0) / completed.length
      : 0

    // Workflow type breakdown (account-level)
    const byType = {}
    runs.forEach(r => {
      const type = r.workflowType || r.workflowName || 'Unknown'
      if (!byType[type]) byType[type] = { success: 0, fail: 0 }
      byType[type].success += (r.successCount || 0)
      byType[type].fail += (r.failureCount || 0)
    })

    return {
      runsToday: todayRuns.length,
      runsDelta: todayRuns.length - yesterdayRuns.length,
      totalSuccess,
      totalFail,
      successRate,
      avgDuration,
      totalAccounts,
      byType,
    }
  }, [runs])

  if (isLoading) {
    return (
      <div className="space-y-3 pb-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 bg-[#111111]" />)}
      </div>
    )
  }

  const statCards = [
    {
      label: 'Success Rate',
      value: `${stats.successRate}%`,
      icon: CheckCircle,
      color: stats.successRate >= 80 ? '#22C55E' : stats.successRate >= 50 ? '#F59E0B' : '#EF4444',
    },
    {
      label: 'Runs Today',
      value: stats.runsToday,
      icon: ScrollText,
      color: '#3B82F6',
      delta: stats.runsDelta,
    },
    {
      label: 'Avg Duration',
      value: formatDuration(stats.avgDuration),
      icon: Clock,
      color: '#A1A1AA',
    },
    {
      label: 'Total Accounts',
      value: stats.totalAccounts,
      icon: Users,
      color: '#A1A1AA',
    },
  ]

  return (
    <div className="space-y-4 pb-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className="w-3.5 h-3.5 text-[#52525B]" />
              <span className="text-xs text-[#52525B]">{s.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold" style={{ color: s.color }}>{s.value}</p>
              {s.delta !== undefined && s.delta !== 0 && (
                <div className={`flex items-center gap-0.5 text-[10px] ${s.delta > 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {s.delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span>{s.delta > 0 ? '+' : ''}{s.delta} vs yesterday</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Workflow type breakdown */}
      {Object.keys(stats.byType).length > 0 && (
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3 space-y-3">
          <p className="text-xs font-medium text-[#A1A1AA]">By Workflow Type</p>
          {Object.entries(stats.byType).map(([type, data]) => {
            const typeTotal = data.success + data.fail
            const successPct = typeTotal > 0 ? (data.success / typeTotal) * 100 : 0
            return (
              <div key={type} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#FAFAFA]">{type}</span>
                  <span className="text-[#52525B]">
                    <span className="text-[#22C55E]">{data.success}</span>
                    {' / '}
                    <span className="text-[#EF4444]">{data.fail}</span>
                    {' '}({Math.round(successPct)}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${successPct}%`,
                      background: successPct >= 80 ? '#22C55E' : successPct >= 50 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
