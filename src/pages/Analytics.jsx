import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { Users, Eye, UserCheck, Trophy } from 'lucide-react'
import Card from '../components/Card'
import InteractiveLineChart from '../components/InteractiveLineChart'
import { useApi } from '../hooks/useApi'

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#f97316']

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

export default function Analytics() {
  const { data: snapData, loading: snapLoading } = useApi('/api/stats/snapshots?days=30')
  const { data: overview, loading: overviewLoading } = useApi('/api/stats/overview')

  const loading = snapLoading || overviewLoading

  const snapshots = snapData?.snapshots || []

  // Efficiency data (views per post)
  const efficiencyData = useMemo(() => {
    if (!snapData?.snapshots?.length) return []

    // Take latest snapshot per username
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
    return Object.values(latest).sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0))
  }, [snapData])

  if (loading) {
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card>
          <div className="flex items-start justify-between mb-3">
            <span className="label-upper">Total Followers</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-emerald-500/10">
              <Users size={14} className="text-emerald-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {formatNumber(overview?.totalFollowers)}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between mb-3">
            <span className="label-upper">Total Views 30j</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-blue-500/10">
              <Eye size={14} className="text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {formatNumber(overview?.totalViews)}
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
                {overview.topPerformer.username}
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
          title="Views Evolution (30 days)"
          snapshots={snapshots}
          dataKey="viewsLast30Days"
        />
      </Card>

      <Card className="mb-3">
        <InteractiveLineChart
          title="Followers Evolution (30 days)"
          snapshots={snapshots}
          dataKey="followerCount"
        />
      </Card>

      {/* Efficiency Chart */}
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
                <YAxis type="category" dataKey="username" tick={{ fill: '#999', fontSize: 11 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} width={100} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={(v) => formatNumber(v)} labelFormatter={() => ''} />
                <Bar dataKey="ratio" radius={[0, 4, 4, 0]} barSize={20}>
                  {efficiencyData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
                  <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Followers</th>
                  <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Views 30j</th>
                  <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Posts</th>
                  <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Views/Post</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-[#333]">No data</td></tr>
                ) : (
                  tableData.map((row, i) => (
                    <tr key={row.username || i} className="border-b border-[#141414] last:border-0 hover:bg-[#111] transition-colors">
                      <td className="px-3 py-2.5 text-white font-medium">{row.username}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#555]">{formatNumber(row.followerCount)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#555]">{formatNumber(row.viewsLast30Days)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#555]">{row.postCount ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#555]">
                        {row.postCount ? formatNumber(Math.round((row.viewsLast30Days || 0) / row.postCount)) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
