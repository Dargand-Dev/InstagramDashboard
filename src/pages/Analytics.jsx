import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { Users, Eye, UserCheck, Trophy, Calendar, ExternalLink } from 'lucide-react'
import Card from '../components/Card'
import InteractiveLineChart from '../components/InteractiveLineChart'
import DailyViewsBarChart from '../components/DailyViewsBarChart'
import DateRangePicker from '../components/DateRangePicker'
import { useApi } from '../hooks/useApi'
import { CHART_COLORS, buildColorMap } from '../utils/chartColors'
import { Blur, useIncognito } from '../contexts/IncognitoContext'

const PERIODS = [
  { key: 'alltime', label: 'All time',         days: 9999, titleSuffix: 'All time' },
  { key: '30d',     label: '30 derniers jours', days: 60,   titleSuffix: '30 days' },
  { key: '7d',      label: '7 derniers jours',  days: 7,    titleSuffix: '7 days' },
  { key: '1d',      label: "Aujourd'hui",       days: 1,    titleSuffix: 'Today' },
]

const tooltipStyle = {
  contentStyle: { backgroundColor: '#111', border: '1px solid #1a1a1a', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#999', marginBottom: 4 },
  itemStyle: { padding: '2px 0', color: '#ccc' },
}

function formatNumber(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function computeAllTimeViews(snapshots) {
  // Group snapshots per account by month, take max viewsLast30Days per month, sum those
  const byAccount = {}
  for (const snap of snapshots) {
    if (!byAccount[snap.username]) byAccount[snap.username] = {}
    const month = snap.snapshotAt?.slice(0, 7) // "YYYY-MM"
    if (!month) continue
    const views = snap.viewsLast30Days || 0
    if (!byAccount[snap.username][month] || views > byAccount[snap.username][month]) {
      byAccount[snap.username][month] = views
    }
  }
  const result = {}
  for (const [username, months] of Object.entries(byAccount)) {
    result[username] = Object.values(months).reduce((sum, v) => sum + v, 0)
  }
  return result
}

export default function Analytics() {
  const [period, setPeriod] = useState('alltime')
  const [customRange, setCustomRange] = useState({ start: null, end: null })
  const [showCalendar, setShowCalendar] = useState(false)
  const [sortCol, setSortCol] = useState('followers')
  const [sortAsc, setSortAsc] = useState(false)

  const currentPeriod = PERIODS.find(p => p.key === period)

  const customDays = customRange.start && customRange.end
    ? Math.ceil((new Date(customRange.end) - new Date(customRange.start)) / 86400000) + 1
    : null

  const apiDays = period === 'custom' ? (customDays != null ? customDays + 30 : 9999) : currentPeriod?.days ?? 9999

  const { data: snapData, loading: snapLoading } = useApi(`/api/stats/snapshots?days=${apiDays}`)
  const { data: allSnapData, loading: allSnapLoading } = useApi('/api/stats/snapshots?days=9999')
  const { data: overview, loading: overviewLoading } = useApi(`/api/stats/overview?days=${apiDays}`)
  const { data: accountsData, loading: accountsLoading } = useApi('/api/accounts')

  const navigate = useNavigate()
  const { isIncognito } = useIncognito()
  const isInitialLoad = (snapLoading || overviewLoading) && !snapData

  const snapshots = snapData?.snapshots || []

  const filteredSnapshots = useMemo(() => {
    if (!snapshots.length) return []
    if (period === 'custom') {
      if (customRange.start && customRange.end) {
        const startISO = new Date(customRange.start + 'T00:00:00').toISOString()
        const endISO = new Date(customRange.end + 'T23:59:59').toISOString()
        return snapshots.filter(s => s.snapshotAt >= startISO && s.snapshotAt <= endISO)
      }
      return snapshots
    }
    if (currentPeriod?.days >= 9999) return snapshots
    const displayDays = currentPeriod?.key === '30d' ? 30 : currentPeriod?.days
    const cutoff = new Date(Date.now() - displayDays * 24 * 60 * 60 * 1000).toISOString()
    return snapshots.filter(s => s.snapshotAt >= cutoff)
  }, [snapshots, currentPeriod, period, customRange])

  const titleSuffix = period === 'custom' && customRange.start && customRange.end
    ? `${customRange.start.slice(8)}/${customRange.start.slice(5, 7)} — ${customRange.end.slice(8)}/${customRange.end.slice(5, 7)}`
    : currentPeriod?.titleSuffix ?? 'All time'

  // Period-aware KPIs
  const periodKpis = useMemo(() => {
    if (period === 'alltime') {
      return { views: overview?.totalViews, followers: overview?.totalFollowers }
    }
    if (!filteredSnapshots.length) return { views: null, followers: null }

    const byUser = {}
    for (const snap of filteredSnapshots) {
      if (!byUser[snap.username]) byUser[snap.username] = { first: snap, last: snap }
      const u = byUser[snap.username]
      if (snap.snapshotAt < u.first.snapshotAt) u.first = snap
      if (snap.snapshotAt > u.last.snapshotAt) u.last = snap
    }

    let totalViewsGain = 0
    let totalFollowersGain = 0
    for (const { first, last } of Object.values(byUser)) {
      if (first !== last) {
        totalViewsGain += Math.max(0, (last.viewsLast30Days || 0) - (first.viewsLast30Days || 0))
        totalFollowersGain += Math.max(0, (last.followerCount || 0) - (first.followerCount || 0))
      }
    }

    return { views: totalViewsGain, followers: totalFollowersGain }
  }, [filteredSnapshots, overview, period])

  // Map of username -> link from accounts
  const accountLinks = useMemo(() => {
    const accounts = accountsData?.accounts || accountsData || []
    if (!Array.isArray(accounts)) return {}
    const map = {}
    for (const acc of accounts) {
      if (acc.username && acc.link) map[acc.username] = acc.link
    }
    return map
  }, [accountsData])

  // All-time views per account
  const allTimeViews = useMemo(() => {
    if (!allSnapData?.snapshots?.length) return {}
    return computeAllTimeViews(allSnapData.snapshots)
  }, [allSnapData])

  // Efficiency data (views per post)
  const efficiencyData = useMemo(() => {
    if (!snapData?.snapshots?.length) return []

    const latest = {}
    for (const snap of snapData.snapshots) {
      if (!latest[snap.username] || snap.snapshotAt > latest[snap.username].snapshotAt) {
        latest[snap.username] = snap
      }
    }

    return Object.values(latest)
      .filter(s => s.postCount > 0)
      .map(s => ({
        username: s.username,
        ratio: Math.round((s.viewsLast30Days || 0) / s.postCount),
        views: s.viewsLast30Days || 0,
        posts: s.postCount,
      }))
      .sort((a, b) => b.ratio - a.ratio)
  }, [snapData])

  // Table data (latest snapshot per account)
  const tableData = useMemo(() => {
    if (!snapData?.snapshots?.length) return []
    const latest = {}
    for (const snap of snapData.snapshots) {
      if (!latest[snap.username] || snap.snapshotAt > latest[snap.username].snapshotAt) {
        latest[snap.username] = snap
      }
    }
    return Object.values(latest)
  }, [snapData])

  // Sorted table data
  const sortedTableData = useMemo(() => {
    const getValue = (row) => {
      const views = allTimeViews[row.username] || 0
      switch (sortCol) {
        case 'followers': return row.followerCount || 0
        case 'views': return views
        case 'posts': return row.postCount || 0
        case 'viewsPerPost': return row.postCount ? Math.round(views / row.postCount) : 0
        default: return 0
      }
    }
    return [...tableData].sort((a, b) => {
      const diff = getValue(a) - getValue(b)
      return sortAsc ? diff : -diff
    })
  }, [tableData, sortCol, sortAsc, allTimeViews])

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc)
    } else {
      setSortCol(col)
      setSortAsc(false)
    }
  }

  const SortHeader = ({ col, children, className = '' }) => (
    <th
      className={`px-3 py-2 label-upper !text-[10px] !mb-0 cursor-pointer select-none hover:text-white transition-colors ${className}`}
      onClick={() => handleSort(col)}
    >
      {children}
      {sortCol === col && (
        <span className="ml-1 text-white">{sortAsc ? '↑' : '↓'}</span>
      )}
    </th>
  )

  // Custom tick renderers that mask text in incognito mode
  const BlurredXTick = ({ x, y, payload }) => (
    <text x={x} y={y} dy={14} textAnchor="middle" fill="#999" fontSize={11}>
      {isIncognito ? '•••' : payload.value}
    </text>
  )

  const BlurredYTick = ({ x, y, payload }) => (
    <text x={x} y={y} dx={-4} textAnchor="end" fill="#999" fontSize={11}>
      {isIncognito ? '•••' : payload.value}
    </text>
  )

  // Stable color map
  const colorMap = useMemo(() => {
    if (!snapshots.length) return {}
    const usernames = new Set(snapshots.map(s => s.username))
    return buildColorMap([...usernames])
  }, [snapshots])

  // Identity performance data
  const identityData = useMemo(() => {
    const breakdown = overview?.identityBreakdown
    if (!breakdown?.length) return []
    return breakdown
      .filter(id => id.accountCount > 0)
      .map(id => ({
        name: id.identityId || id.identityName || id.identity || `Identity ${breakdown.indexOf(id) + 1}`,
        accounts: id.accountCount,
        totalFollowers: id.totalFollowers || 0,
        totalViews: id.totalViews || 0,
        viewsPerAccount: Math.round((id.totalViews || 0) / id.accountCount),
        followersPerAccount: Math.round((id.totalFollowers || 0) / id.accountCount),
      }))
      .sort((a, b) => b.viewsPerAccount - a.viewsPerAccount)
  }, [overview])

  if (isInitialLoad) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Analytics</h1>
        <p className="text-xs text-[#333] mt-0.5 mb-6">Account performance & evolution</p>
        <div className="flex items-center justify-center h-64 text-[#333] text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Analytics</h1>
        <p className="text-xs text-[#333] mt-0.5">Account performance & evolution</p>
      </div>

      {/* Period selector */}
      <div className="flex gap-1.5 mb-6 flex-wrap relative">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => { setPeriod(p.key); setShowCalendar(false); setCustomRange({ start: null, end: null }) }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide transition-colors border ${
              period === p.key
                ? 'bg-white/10 text-white border-[#333]'
                : 'bg-transparent text-[#555] border-[#1a1a1a] hover:text-white hover:border-[#333]'
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="relative">
          <button
            onClick={() => {
              if (period === 'custom') {
                setShowCalendar(prev => !prev)
              } else {
                setPeriod('custom')
                setShowCalendar(true)
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide transition-colors border ${
              period === 'custom'
                ? 'bg-white/10 text-white border-[#333]'
                : 'bg-transparent text-[#555] border-[#1a1a1a] hover:text-white hover:border-[#333]'
            }`}
          >
            <Calendar size={11} />
            {period === 'custom' && customRange.start && customRange.end
              ? `${customRange.start.slice(8)}/${customRange.start.slice(5, 7)} — ${customRange.end.slice(8)}/${customRange.end.slice(5, 7)}`
              : 'Personnaliser'}
          </button>
          {showCalendar && (
            <DateRangePicker
              startDate={customRange.start}
              endDate={customRange.end}
              onChange={(start, end) => {
                setCustomRange({ start, end })
                if (!start && !end) {
                  setPeriod('alltime')
                }
              }}
              onClose={() => setShowCalendar(false)}
            />
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card>
          <div className="flex items-start justify-between mb-3">
            <span className="label-upper">{period === 'alltime' ? 'Total Followers' : `Followers +${titleSuffix}`}</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-emerald-500/10">
              <Users size={14} className="text-emerald-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {period !== 'alltime' && periodKpis.followers != null ? '+' : ''}{formatNumber(periodKpis.followers)}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between mb-3">
            <span className="label-upper">{period === 'alltime' ? 'Total Views' : `Views +${titleSuffix}`}</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-blue-500/10">
              <Eye size={14} className="text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {period !== 'alltime' && periodKpis.views != null ? '+' : ''}{formatNumber(periodKpis.views)}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between mb-3">
            <span className="label-upper">Comptes Actifs</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-purple-500/10">
              <UserCheck size={14} className="text-purple-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {overview?.activeAccounts ?? '—'}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between mb-3">
            <span className="label-upper">Top Performer</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-amber-500/10">
              <Trophy size={14} className="text-amber-400" />
            </div>
          </div>
          {overview?.topPerformer ? (
            <>
              <div className="text-lg font-extrabold text-white tracking-tight">
                <Blur>{overview.topPerformer.username}</Blur>
              </div>
              <p className="text-xs text-[#555] mt-1">
                {formatNumber(overview.topPerformer.followerCount)} followers · {formatNumber(overview.topPerformer.viewsLast30Days)} views
              </p>
            </>
          ) : (
            <span className="text-xs text-[#333]">—</span>
          )}
        </Card>
      </div>

      {/* Interactive Charts */}
      <Card className="mb-3">
        <InteractiveLineChart
          title={`Views Evolution (${titleSuffix})`}
          snapshots={filteredSnapshots}
          dataKey="viewsLast30Days"
          colorMap={colorMap}
        />
      </Card>

      <Card className="mb-3">
        <InteractiveLineChart
          title={`Followers Evolution (${titleSuffix})`}
          snapshots={filteredSnapshots}
          dataKey="followerCount"
          colorMap={colorMap}
        />
      </Card>

      <Card className="mb-3">
        <DailyViewsBarChart
          title="Daily Views"
          snapshots={snapshots}
          colorMap={colorMap}
          displayDays={period === 'custom' ? customDays : (currentPeriod?.key === '30d' ? 30 : currentPeriod?.days)}
        />
      </Card>

      {/* Identity Performance */}
      {identityData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          <Card>
            <span className="label-upper block mb-4">Identity Performance (per Account)</span>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={identityData} margin={{ left: 10 }}>
                <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={<BlurredXTick />} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} />
                <YAxis tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} tickFormatter={formatNumber} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={(v, name) => [formatNumber(v), name]} labelFormatter={isIncognito ? () => '•••' : undefined} />
                <Bar dataKey="viewsPerAccount" name="Views / Account" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="followersPerAccount" name="Followers / Account" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <span className="label-upper block mb-4">Identity Breakdown</span>
            <div className="overflow-hidden rounded-md border border-[#1a1a1a]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a1a]">
                    <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Identity</th>
                    <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Accounts</th>
                    <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Followers</th>
                    <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Views</th>
                    <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Fol/Acc</th>
                    <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Views/Acc</th>
                  </tr>
                </thead>
                <tbody>
                  {identityData.map((row, i) => (
                    <tr key={row.name || i} className="border-b border-[#141414] last:border-0 hover:bg-[#111] transition-colors">
                      <td className="px-3 py-2.5 text-white font-medium"><Blur>{row.name}</Blur></td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#555]">{row.accounts}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#555]">{formatNumber(row.totalFollowers)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#555]">{formatNumber(row.totalViews)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-400">{formatNumber(row.followersPerAccount)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-blue-400">{formatNumber(row.viewsPerAccount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Efficiency Chart + Account Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <Card>
          <span className="label-upper block mb-4">Efficiency (Views / Post)</span>
          {efficiencyData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-[#333] text-xs">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, efficiencyData.length * 40)}>
              <BarChart data={efficiencyData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} tickFormatter={formatNumber} />
                <YAxis type="category" dataKey="username" tick={<BlurredYTick />} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} width={100} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={(v) => formatNumber(v)} labelFormatter={() => ''} />
                <Bar dataKey="ratio" radius={[0, 4, 4, 0]} barSize={20}>
                  {efficiencyData.map((entry, i) => (
                    <Cell key={i} fill={colorMap[entry.username] || CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Detail Table */}
        <Card>
          <span className="label-upper block mb-4">Account Details</span>
          <div className="overflow-hidden rounded-md border border-[#1a1a1a]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a1a1a]">
                  <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Username</th>
                  <SortHeader col="followers" className="text-right">Followers</SortHeader>
                  <SortHeader col="views" className="text-right">Views All Time</SortHeader>
                  <SortHeader col="posts" className="text-right">Posts</SortHeader>
                  <SortHeader col="viewsPerPost" className="text-right">Views/Post</SortHeader>
                </tr>
              </thead>
              <tbody>
                {sortedTableData.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-[#333]">No data</td></tr>
                ) : (
                  sortedTableData.map((row, i) => {
                    const views = allTimeViews[row.username] || 0
                    const link = accountLinks[row.username]
                    return (
                      <tr
                        key={row.username || i}
                        className="border-b border-[#141414] last:border-0 hover:bg-[#111] transition-colors cursor-pointer"
                        onClick={() => navigate(`/accounts?username=${encodeURIComponent(row.username)}`)}
                      >
                        <td className="px-3 py-2.5 text-white font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <Blur>{row.username}</Blur>
                            {link && (
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#555] hover:text-blue-400 transition-colors"
                                onClick={e => e.stopPropagation()}
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#555]">{formatNumber(row.followerCount)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#555]">{formatNumber(views)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#555]">{row.postCount ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#555]">
                          {row.postCount ? formatNumber(Math.round(views / row.postCount)) : '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
