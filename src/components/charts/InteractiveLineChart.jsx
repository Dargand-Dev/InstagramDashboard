import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

import { CHART_COLORS } from '@/utils/chartColors'
import { toBangkokISO } from '@/utils/format'
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

    // Un slot = un timestamp exact (ISO minute-près). Chaque snapshot produit son propre point.
    const getSlot = (snapshotAt) => {
      if (!snapshotAt) return null
      const local = toBangkokISO(snapshotAt)
      return local.slice(0, 16) // YYYY-MM-DDTHH:mm
    }

    // ts = millis UTC du début de la minute, pour un axe temporel proportionnel.
    const slotToTs = (slot) => Date.parse(`${slot}:00Z`)

    const bySlot = {}
    const totalBySlot = {}
    for (const snap of snapshots) {
      const slot = getSlot(snap.snapshotAt)
      if (!slot) continue
      const val = snap[dataKey] ?? 0
      if (top15Set.has(snap.username)) {
        if (!bySlot[slot]) bySlot[slot] = {}
        // Au cas (rare) où 2 snapshots auraient exactement la même minute, on garde la max.
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

    // Total Fleet : un compte sans snapshot à un slot t ne doit pas tomber à 0 —
    // on forward-fill sa dernière valeur connue pour éviter les dents de scie.
    const sortedSlots = Object.keys(totalBySlot).sort()
    const lastKnown = {}
    return sortedSlots.map(slot => {
      for (const [username, v] of Object.entries(totalBySlot[slot] || {})) {
        lastKnown[username] = v
      }
      const total = Object.values(lastKnown).reduce((sum, v) => sum + (v || 0), 0)
      return {
        ts: slotToTs(slot),
        ...bySlot[slot],
        __total: total,
      }
    })
  }, [snapshots, top15, dataKey])

  const formatTick = (ts) => {
    const d = new Date(ts)
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mi = String(d.getUTCMinutes()).padStart(2, '0')
    return `${dd}/${mm} ${hh}:${mi}`
  }

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
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTick}
            tick={{ fill: '#555', fontSize: 10 }}
            axisLine={{ stroke: '#1a1a1a' }}
            tickLine={false}
            angle={-30}
            textAnchor="end"
            height={45}
          />
          <YAxis tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} tickFormatter={formatNumber} />
          <Tooltip content={<LineChartTooltip isIncognito={isIncognito} colorMap={colorMap} top15={top15} />} labelFormatter={formatTick} />
          <Line
            key="__total"
            type="basis"
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
              type="basis"
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
