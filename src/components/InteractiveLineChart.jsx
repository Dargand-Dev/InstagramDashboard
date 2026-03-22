import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

const COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#a855f7',
  '#84cc16', '#e11d48', '#0ea5e9', '#d946ef', '#fbbf24'
]

const tooltipStyle = {
  contentStyle: { backgroundColor: '#111', border: '1px solid #1a1a1a', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#888' },
  itemStyle: { color: '#fff', padding: '2px 0' },
}

function formatNumber(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default function InteractiveLineChart({ title, snapshots, dataKey }) {
  // Get top 15 accounts by latest value of dataKey
  const top15 = useMemo(() => {
    if (!snapshots?.length) return []
    const latest = {}
    for (const snap of snapshots) {
      if (!latest[snap.username] || snap.snapshotAt > latest[snap.username].snapshotAt) {
        latest[snap.username] = snap
      }
    }
    return Object.values(latest)
      .sort((a, b) => (b[dataKey] || 0) - (a[dataKey] || 0))
      .slice(0, 15)
      .map(s => s.username)
  }, [snapshots, dataKey])

  const [selected, setSelected] = useState(null)

  // Initialize selected to first 5 on first render / when top15 changes
  const activeSet = useMemo(() => {
    if (selected !== null) return selected
    return new Set(top15.slice(0, 5))
  }, [selected, top15])

  // Build series data grouped by date, only for top15 accounts
  const series = useMemo(() => {
    if (!snapshots?.length || !top15.length) return []
    const top15Set = new Set(top15)
    const byDate = {}
    for (const snap of snapshots) {
      if (!top15Set.has(snap.username)) continue
      const date = snap.snapshotAt?.slice(0, 10)
      if (!date) continue
      if (!byDate[date]) byDate[date] = {}
      byDate[date][snap.username] = snap[dataKey] ?? null
    }
    return Object.keys(byDate).sort().map(date => ({
      date: `${date.slice(8)}/${date.slice(5, 7)}`,
      ...byDate[date]
    }))
  }, [snapshots, top15, dataKey])

  const toggle = (username) => {
    setSelected(prev => {
      const s = new Set(prev ?? activeSet)
      if (s.has(username)) s.delete(username)
      else s.add(username)
      return s
    })
  }

  const selectAll = () => setSelected(new Set(top15))
  const selectNone = () => setSelected(new Set())

  if (!snapshots?.length || !top15.length) {
    return (
      <div>
        <span className="label-upper block mb-4">{title}</span>
        <div className="h-64 flex items-center justify-center text-[#333] text-xs">No data</div>
      </div>
    )
  }

  return (
    <div>
      <span className="label-upper block mb-3">{title}</span>

      {/* Toggle pills */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <button
          onClick={selectAll}
          className="px-2 py-0.5 rounded text-[10px] font-semibold border border-[#1a1a1a] text-[#555] hover:text-white hover:border-[#333] transition-colors"
        >
          All
        </button>
        <button
          onClick={selectNone}
          className="px-2 py-0.5 rounded text-[10px] font-semibold border border-[#1a1a1a] text-[#555] hover:text-white hover:border-[#333] transition-colors"
        >
          None
        </button>
        <span className="w-px h-4 bg-[#1a1a1a] mx-1" />
        {top15.map((username, i) => {
          const color = COLORS[i % COLORS.length]
          const active = activeSet.has(username)
          return (
            <button
              key={username}
              onClick={() => toggle(username)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                active ? '' : 'border-[#1a1a1a] text-[#555] opacity-60'
              }`}
              style={active ? { borderColor: color, color: 'white' } : undefined}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {username}
            </button>
          )
        })}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={series}>
          <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} />
          <YAxis tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} tickFormatter={formatNumber} />
          <Tooltip {...tooltipStyle} formatter={(v) => formatNumber(v)} />
          {top15.map((username, i) => (
            <Line
              key={username}
              type="monotone"
              dataKey={username}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
              hide={!activeSet.has(username)}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
