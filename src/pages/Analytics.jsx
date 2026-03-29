import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import DataTable from '@/components/shared/DataTable'
import StatusBadge from '@/components/shared/StatusBadge'
import HealthScoreBadge from '@/components/shared/HealthScoreBadge'
import TimeAgo from '@/components/shared/TimeAgo'
import EmptyState from '@/components/shared/EmptyState'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import {
  Users, Eye, FileText, TrendingUp, TrendingDown,
  Download, BarChart3, Layers,
} from 'lucide-react'

const RANGE_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
]

const ACCOUNT_COLORS = [
  '#3B82F6', '#8B5CF6', '#22C55E', '#F59E0B', '#EF4444',
  '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
]

function MetricCard({ icon: Icon, label, value, subtitle, loading, color = '#3B82F6', trend }) {
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
        <div className="flex items-end gap-2">
          <div className="text-2xl font-semibold text-[#FAFAFA]">{value}</div>
          {trend !== undefined && trend !== null && (
            <div className={`flex items-center gap-0.5 text-xs mb-1 ${trend >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        {subtitle && <p className="text-xs text-[#52525B] mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-[#52525B] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-medium" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

function exportTableCSV(accounts) {
  const headers = ['Username', 'Status', 'Followers', 'Views (30d)', 'Posts', 'Health Score', 'Last Post']
  const rows = accounts.map(a => [
    a.username, a.status, a.followers ?? '', a.views ?? '', a.posts ?? a.postsCount ?? '',
    a.healthScore ?? '', a.lastPostDate || '',
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `accounts-analytics-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function Analytics() {
  const navigate = useNavigate()
  const [viewsRange, setViewsRange] = useState(30)
  const [viewMode, setViewMode] = useState('aggregate') // aggregate | individual
  const [followerAccounts, setFollowerAccounts] = useState(new Set())

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiGet('/api/accounts'),
  })

  const { data: snapshotsData, isLoading: snapshotsLoading } = useQuery({
    queryKey: ['snapshots', viewsRange],
    queryFn: () => apiGet(`/api/stats/snapshots?days=${viewsRange}`),
  })

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['health-overview'],
    queryFn: () => apiGet('/api/accounts/health/overview'),
  })

  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ['content-status'],
    queryFn: () => apiGet('/api/automation/content-status'),
  })

  // Normalize data
  const accounts = useMemo(() => {
    const raw = accountsData?.data || accountsData || []
    return Array.isArray(raw) ? raw : []
  }, [accountsData])

  const healthAccounts = useMemo(() => {
    const raw = healthData?.data || healthData || {}
    return raw.accounts || raw.data || []
  }, [healthData])

  const snapshots = useMemo(() => {
    const raw = snapshotsData?.data || snapshotsData || []
    return Array.isArray(raw) ? raw : []
  }, [snapshotsData])

  const content = useMemo(() => {
    const raw = contentData?.data || contentData || {}
    return raw.identities || raw.byIdentity || raw
  }, [contentData])

  // Fleet overview metrics
  const fleetMetrics = useMemo(() => {
    const activeAccounts = accounts.filter(a => a.status === 'ACTIVE' || a.status === 'active')
    const totalFollowers = activeAccounts.reduce((sum, a) => sum + (a.followers || a.followerCount || 0), 0)
    const totalViews = activeAccounts.reduce((sum, a) => sum + (a.views || a.viewCount || a.views30d || 0), 0)
    const totalPosts = activeAccounts.reduce((sum, a) => sum + (a.posts || a.postsCount || a.postCount || 0), 0)
    const avgPosts = activeAccounts.length > 0 ? Math.round(totalPosts / activeAccounts.length) : 0

    // Growth rate from snapshots
    let growthRate = null
    if (snapshots.length > 7) {
      const recentWeek = snapshots.slice(-7)
      const previousWeek = snapshots.slice(-14, -7)
      if (previousWeek.length > 0) {
        const recentFollowers = recentWeek.reduce((sum, s) => sum + (s.totalFollowers || s.followers || 0), 0) / recentWeek.length
        const prevFollowers = previousWeek.reduce((sum, s) => sum + (s.totalFollowers || s.followers || 0), 0) / previousWeek.length
        if (prevFollowers > 0) {
          growthRate = ((recentFollowers - prevFollowers) / prevFollowers) * 100
        }
      }
    }

    return { totalFollowers, totalViews, avgPosts, growthRate, activeCount: activeAccounts.length }
  }, [accounts, snapshots])

  // Views trend chart data
  const viewsTrendData = useMemo(() => {
    if (!snapshots.length) return []

    const byDate = {}
    snapshots.forEach(s => {
      const date = (s.date || s.snapshotDate || '').slice(0, 10)
      if (!date) return
      if (!byDate[date]) byDate[date] = { date, totalViews: 0, accounts: {} }
      const views = s.views || s.viewCount || 0
      byDate[date].totalViews += views
      if (s.username || s.accountName) {
        byDate[date].accounts[s.username || s.accountName] = views
      }
    })

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  }, [snapshots])

  // Detect declining periods
  const viewsWithTrend = useMemo(() => {
    return viewsTrendData.map((d, i) => {
      if (i === 0) return { ...d, declining: false }
      const prev = viewsTrendData[i - 1]
      const declining = i >= 2 && d.totalViews < prev.totalViews && prev.totalViews < viewsTrendData[i - 2].totalViews
      return { ...d, declining }
    })
  }, [viewsTrendData])

  // Unique account names from snapshots for individual view
  const snapshotAccountNames = useMemo(() => {
    const names = new Set()
    snapshots.forEach(s => {
      if (s.username || s.accountName) names.add(s.username || s.accountName)
    })
    return [...names]
  }, [snapshots])

  // Follower growth data (top 10)
  const followerGrowthData = useMemo(() => {
    if (!snapshots.length) return { data: [], accounts: [] }

    // Find top 10 by latest follower count
    const latestByAccount = {}
    snapshots.forEach(s => {
      const name = s.username || s.accountName
      if (!name) return
      const followers = s.followers || s.followerCount || 0
      if (!latestByAccount[name] || followers > latestByAccount[name]) {
        latestByAccount[name] = followers
      }
    })

    const top10 = Object.entries(latestByAccount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name)

    // Build chart data by date
    const byDate = {}
    snapshots.forEach(s => {
      const name = s.username || s.accountName
      if (!name || !top10.includes(name)) return
      const date = (s.date || s.snapshotDate || '').slice(0, 10)
      if (!date) return
      if (!byDate[date]) byDate[date] = { date }
      byDate[date][name] = s.followers || s.followerCount || 0
    })

    return {
      data: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)),
      accounts: top10,
    }
  }, [snapshots])

  // Toggle follower account visibility
  const toggleFollowerAccount = (name) => {
    setFollowerAccounts(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const visibleFollowerAccounts = followerGrowthData.accounts.filter(
    name => followerAccounts.size === 0 || followerAccounts.has(name)
  )

  // Per-account table data
  const tableData = useMemo(() => {
    const healthMap = {}
    if (Array.isArray(healthAccounts)) {
      healthAccounts.forEach(h => {
        healthMap[h.username || h.accountName || h.id] = h.healthScore ?? h.score
      })
    }

    return accounts.map(a => ({
      ...a,
      healthScore: healthMap[a.username] ?? healthMap[a.id] ?? a.healthScore ?? null,
      views: a.views || a.viewCount || a.views30d || 0,
      followers: a.followers || a.followerCount || 0,
      posts: a.posts || a.postsCount || a.postCount || 0,
    }))
  }, [accounts, healthAccounts])

  const tableColumns = useMemo(() => [
    {
      accessorKey: 'username',
      header: 'Username',
      cell: ({ row }) => (
        <button
          className="text-[#FAFAFA] hover:text-[#3B82F6] transition-colors font-medium"
          onClick={() => navigate(`/accounts?filter=${row.original.username}`)}
        >
          {row.original.username}
        </button>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'followers',
      header: 'Followers',
      cell: ({ row }) => <span className="text-[#FAFAFA] tabular-nums">{(row.original.followers || 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'views',
      header: 'Views (30d)',
      cell: ({ row }) => <span className="tabular-nums">{(row.original.views || 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'posts',
      header: 'Posts',
      cell: ({ row }) => <span className="tabular-nums">{row.original.posts || 0}</span>,
    },
    {
      accessorKey: 'healthScore',
      header: 'Health',
      cell: ({ row }) => row.original.healthScore != null
        ? <HealthScoreBadge score={row.original.healthScore} />
        : <span className="text-[#52525B]">—</span>,
    },
    {
      accessorKey: 'lastPostDate',
      header: 'Last Post',
      cell: ({ row }) => <TimeAgo date={row.original.lastPostDate || row.original.lastPost} />,
    },
  ], [navigate])

  // Content stock chart data
  const contentChartData = useMemo(() => {
    if (!content || typeof content !== 'object') return []
    return Object.entries(content).map(([name, data]) => {
      const count = data.reelCount || data.count || (typeof data === 'number' ? data : 0)
      return {
        name,
        reels: count,
        fill: count > 20 ? '#22C55E' : count >= 5 ? '#F59E0B' : '#EF4444',
      }
    })
  }, [content])

  const isLoading = accountsLoading || snapshotsLoading

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#FAFAFA]">Growth & Stats</h1>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-[#52525B] hover:text-[#A1A1AA]"
          onClick={() => exportTableCSV(tableData)}
          disabled={!tableData.length}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Fleet Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Users}
          label="Total Followers"
          value={fleetMetrics.totalFollowers.toLocaleString()}
          subtitle={`${fleetMetrics.activeCount} active accounts`}
          loading={isLoading}
          color="#3B82F6"
        />
        <MetricCard
          icon={Eye}
          label="Total Views (30d)"
          value={fleetMetrics.totalViews.toLocaleString()}
          loading={isLoading}
          color="#8B5CF6"
        />
        <MetricCard
          icon={FileText}
          label="Avg Posts / Account"
          value={fleetMetrics.avgPosts}
          loading={isLoading}
          color="#22C55E"
        />
        <MetricCard
          icon={TrendingUp}
          label="Growth Rate"
          value={fleetMetrics.growthRate !== null ? `${fleetMetrics.growthRate >= 0 ? '+' : ''}${fleetMetrics.growthRate.toFixed(1)}%` : '—'}
          subtitle="Week over week"
          loading={isLoading}
          color={fleetMetrics.growthRate >= 0 ? '#22C55E' : '#EF4444'}
          trend={fleetMetrics.growthRate}
        />
      </div>

      {/* Views Trend Chart */}
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardHeader>
          <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#8B5CF6]" />
            Views Trend
          </CardTitle>
          <CardAction>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[#0A0A0A] rounded-lg border border-[#1a1a1a] p-0.5">
                <button
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${viewMode === 'aggregate' ? 'bg-[#1a1a1a] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'}`}
                  onClick={() => setViewMode('aggregate')}
                >
                  <Layers className="w-3 h-3 inline mr-1" />Fleet
                </button>
                <button
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${viewMode === 'individual' ? 'bg-[#1a1a1a] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'}`}
                  onClick={() => setViewMode('individual')}
                >
                  <Users className="w-3 h-3 inline mr-1" />Individual
                </button>
              </div>
              <div className="flex items-center bg-[#0A0A0A] rounded-lg border border-[#1a1a1a] p-0.5">
                {RANGE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${viewsRange === opt.value ? 'bg-[#1a1a1a] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'}`}
                    onClick={() => setViewsRange(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {snapshotsLoading ? (
            <Skeleton className="h-72 w-full bg-[#1a1a1a] rounded-lg" />
          ) : viewsWithTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={viewsWithTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis
                  dataKey="date"
                  stroke="#52525B"
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => v.slice(5)}
                />
                <YAxis stroke="#52525B" tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <RechartsTooltip content={<CustomTooltip />} />
                {viewMode === 'aggregate' ? (
                  <Line
                    type="monotone"
                    dataKey="totalViews"
                    name="Total Views"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#8B5CF6' }}
                  />
                ) : (
                  snapshotAccountNames.slice(0, 10).map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={`accounts.${name}`}
                      name={name}
                      stroke={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]}
                      strokeWidth={1.5}
                      dot={false}
                    />
                  ))
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={Eye} title="No views data" description="Snapshot data will appear here once collected" />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Follower Growth Chart */}
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
              Follower Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            {snapshotsLoading ? (
              <Skeleton className="h-60 w-full bg-[#1a1a1a] rounded-lg" />
            ) : followerGrowthData.data.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={followerGrowthData.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis dataKey="date" stroke="#52525B" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                    <YAxis stroke="#52525B" tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    {visibleFollowerAccounts.map((name, i) => (
                      <Area
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stackId="1"
                        stroke={ACCOUNT_COLORS[followerGrowthData.accounts.indexOf(name) % ACCOUNT_COLORS.length]}
                        fill={ACCOUNT_COLORS[followerGrowthData.accounts.indexOf(name) % ACCOUNT_COLORS.length]}
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {followerGrowthData.accounts.map((name, i) => (
                    <button
                      key={name}
                      className={`px-2 py-0.5 text-xs rounded-md border transition-colors ${
                        followerAccounts.size === 0 || followerAccounts.has(name)
                          ? 'border-current opacity-100'
                          : 'border-[#1a1a1a] opacity-40'
                      }`}
                      style={{ color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] }}
                      onClick={() => toggleFollowerAccount(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon={TrendingUp} title="No follower data" description="Growth data will appear once snapshots are collected" />
            )}
          </CardContent>
        </Card>

        {/* Content Stock Chart */}
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#F59E0B]" />
              Content Stock by Identity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contentLoading ? (
              <Skeleton className="h-60 w-full bg-[#1a1a1a] rounded-lg" />
            ) : contentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={contentChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
                  <XAxis type="number" stroke="#52525B" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" stroke="#52525B" tick={{ fontSize: 11 }} width={100} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="reels" name="Reels" radius={[0, 4, 4, 0]}>
                    {contentChartData.map((entry, i) => (
                      <rect key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={BarChart3} title="No content data" description="Identity content status will appear here" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-Account Stats Table */}
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardHeader>
          <CardTitle className="text-sm text-[#A1A1AA]">Per-Account Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={tableColumns}
            data={tableData}
            loading={accountsLoading || healthLoading}
            searchable
            searchPlaceholder="Search accounts..."
            pageSize={20}
          />
        </CardContent>
      </Card>
    </div>
  )
}
