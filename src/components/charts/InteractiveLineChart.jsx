import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

import { CHART_COLORS } from '@/utils/chartColors'
import { Blur, useIncognito } from '@/contexts/IncognitoContext'

function formatNumber(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function LineChartTooltip({ active, payload, label, isIncognito, colorMap, top15 }) {
  if (!active || !payload?.length) return null
  const items = payload.filter(p => p.value != null && p.value > 0).sort((a, b) => (b.value || 0) - (a.value || 0))
  if (!items.length) return null
  return (
    <div style={{ backgroundColor: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: '#888', marginBottom: 4 }}>{label}</div>
      {items.map(item => (
        <div key={item.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: item.dataKey === '__total' ? '#ffffff' : (colorMap?.[item.dataKey] || CHART_COLORS[top15.indexOf(item.dataKey) % CHART_COLORS.length]),
            flexShrink: 0
          }} />
          <span style={{ color: '#ccc', filter: isIncognito && item.dataKey !== '__total' ? 'blur(5px)' : 'none' }}>
            {item.dataKey === '__total' ? 'Total Fleet' : item.dataKey}
          </span>
          <span style={{ color: '#fff', marginLeft: 'auto', fontWeight: 600 }}>{formatNumber(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function InteractiveLineChart({ title, snapshots, dataKey, colorMap }) {
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

  const { isIncognito } = useIncognito()
  const [selected, setSelected] = useState(null)
  const [showTotal, setShowTotal] = useState(false)

  const activeSet = useMemo(() => {
    if (selected !== null) return selected
    return new Set(top15.slice(0, 5))
  }, [selected, top15])

  const series = useMemo(() => {
    if (!snapshots?.length || !top15.length) return []
    const top15Set = new Set(top15)

    const getSlot = (snapshotAt) => {
      if (!snapshotAt) return null
      const date = snapshotAt.slice(0, 10)
      const hour = parseInt(snapshotAt.slice(11, 13) || '0', 10)
      return `${date}T${hour < 12 ? '0' : '1'}`
    }

    const formatSlot = (slot) => {
      const date = slot.slice(0, 10)
      const half = slot.slice(11) === '1' ? 'PM' : 'AM'
      return `${date.slice(8)}/${date.slice(5, 7)} ${half}`
    }

    const bySlot = {}
    const totalBySlot = {}
    for (const snap of snapshots) {
      const slot = getSlot(snap.snapshotAt)
      if (!slot) continue
      const val = snap[dataKey] ?? 0
      if (top15Set.has(snap.username)) {
        if (!bySlot[slot]) bySlot[slot] = {}
        const existing = bySlot[slot][snap.username]
        if (existing == null || val > existing) {
          bySlot[slot][snap.username] = val
        }
      }
      if (!totalBySlot[slot]) totalBySlot[slot] = {}
      const existingTotal = totalBySlot[slot][snap.username]
      if (existingTotal == null || val > existingTotal) {
        totalBySlot[slot][snap.username] = val
      }
    }
    return Object.keys(bySlot).sort().map(slot => ({
      date: formatSlot(slot),
      ...bySlot[slot],
      __total: Object.values(totalBySlot[slot] || {}).reduce((sum, v) => sum + (v || 0), 0),
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
        <button
          onClick={() => setShowTotal(t => !t)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
            showTotal ? '' : 'border-[#1a1a1a] text-[#555] opacity-60'
          }`}
          style={showTotal ? { borderColor: '#ffffff', color: 'white' } : undefined}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ffffff' }} />
          Total Fleet
        </button>
        <span className="w-px h-4 bg-[#1a1a1a] mx-1" />
        {top15.map((username, i) => {
          const color = colorMap?.[username] || CHART_COLORS[i % CHART_COLORS.length]
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
              <Blur>{username}</Blur>
            </button>
          )
        })}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={series}>
          <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} interval="preserveStartEnd" angle={-30} textAnchor="end" height={45} />
          <YAxis tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} tickFormatter={formatNumber} />
          <Tooltip content={<LineChartTooltip isIncognito={isIncognito} colorMap={colorMap} top15={top15} />} />
          <Line
            key="__total"
            type="monotone"
            dataKey="__total"
            name="Total Fleet"
            stroke="#ffffff"
            strokeWidth={2.5}
            strokeDasharray="6 3"
            dot={false}
            connectNulls
            hide={!showTotal}
            isAnimationActive={false}
          />
          {top15.map((username, i) => (
            <Line
              key={username}
              type="monotone"
              dataKey={username}
              stroke={colorMap?.[username] || CHART_COLORS[i % CHART_COLORS.length]}
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
