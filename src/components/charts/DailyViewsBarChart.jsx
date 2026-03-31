import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
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

function CustomTooltip({ active, payload, label, activeSet, showTotal, top15, colorMap, isIncognito }) {
  if (!active || !payload?.length) return null
  const items = payload
    .filter(p => {
      if (p.dataKey === '__total') return showTotal
      return activeSet.has(p.dataKey) && p.value > 0
    })
    .sort((a, b) => (b.value || 0) - (a.value || 0))

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
          <span style={{ color: '#ccc', filter: isIncognito && item.dataKey !== '__total' ? 'blur(5px)' : 'none' }}>{item.dataKey === '__total' ? 'Total Fleet' : item.dataKey}</span>
          <span style={{ color: '#fff', marginLeft: 'auto', fontWeight: 600 }}>{formatNumber(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function DailyViewsBarChart({ title, snapshots, colorMap, displayDays: displayDaysProp = 30 }) {
  const { isIncognito } = useIncognito()
  const top15 = useMemo(() => {
    if (!snapshots?.length) return []
    const latest = {}
    for (const snap of snapshots) {
      if (!latest[snap.username] || snap.snapshotAt > latest[snap.username].snapshotAt) {
        latest[snap.username] = snap
      }
    }
    return Object.values(latest)
      .sort((a, b) => (b.viewsLast30Days || 0) - (a.viewsLast30Days || 0))
      .slice(0, 15)
      .map(s => s.username)
  }, [snapshots])

  const [selected, setSelected] = useState(null)
  const [showTotal, setShowTotal] = useState(false)

  const activeSet = useMemo(() => {
    if (selected !== null) return selected
    return new Set(top15.slice(0, 5))
  }, [selected, top15])

  const chartData = useMemo(() => {
    if (!snapshots?.length || !top15.length) return []

    const dateDaysAgo = (dateStr, n) => {
      const d = new Date(dateStr + 'T00:00:00')
      d.setDate(d.getDate() - n)
      return d.toISOString().slice(0, 10)
    }

    const R = {}
    const allUsernames = new Set()
    for (const snap of snapshots) {
      if (!snap.snapshotAt) continue
      const day = snap.snapshotAt.slice(0, 10)
      const username = snap.username
      allUsernames.add(username)
      if (!R[username]) R[username] = {}
      if (!R[username][day] || snap.snapshotAt > R[username][day].at) {
        R[username][day] = { at: snap.snapshotAt, val: snap.viewsLast30Days || 0 }
      }
    }

    const dailyViews = {}
    for (const username of allUsernames) {
      const dayMap = R[username] || {}
      const days = Object.keys(dayMap).sort()
      if (!days.length) continue

      const computed = {}
      for (let i = 0; i < days.length; i++) {
        const day = days[i]
        const rToday = dayMap[day].val
        if (i === 0) {
          computed[day] = rToday
        } else {
          const rPrev = dayMap[days[i - 1]].val
          let views = rToday - rPrev
          const day30Ago = dateDaysAgo(day, 30)
          if (computed[day30Ago] !== undefined) {
            views += computed[day30Ago]
          }
          computed[day] = Math.max(0, views)
        }
      }
      dailyViews[username] = computed
    }

    const allDaysSet = new Set()
    for (const username of allUsernames) {
      for (const day of Object.keys(dailyViews[username] || {})) {
        allDaysSet.add(day)
      }
    }
    const allDays = Array.from(allDaysSet).sort()
    const displayDays = displayDaysProp >= 9999 ? allDays : allDays.slice(-displayDaysProp)

    return displayDays.map(day => {
      const point = {
        date: `${day.slice(8)}/${day.slice(5, 7)}`,
      }
      let total = 0
      for (const username of top15) {
        point[username] = dailyViews[username]?.[day] || 0
      }
      for (const username of allUsernames) {
        total += dailyViews[username]?.[day] || 0
      }
      point.__total = total
      return point
    })
  }, [snapshots, top15, displayDaysProp])

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
        <ComposedChart data={chartData}>
          <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} interval="preserveStartEnd" angle={-30} textAnchor="end" height={45} />
          <YAxis tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} tickFormatter={formatNumber} />
          <Tooltip content={<CustomTooltip activeSet={activeSet} showTotal={showTotal} top15={top15} colorMap={colorMap} isIncognito={isIncognito} />} />
          {top15.map((username, i) => (
            <Bar
              key={username}
              dataKey={username}
              stackId="accounts"
              fill={colorMap?.[username] || CHART_COLORS[i % CHART_COLORS.length]}
              hide={!activeSet.has(username)}
              isAnimationActive={false}
            />
          ))}
          <Line
            dataKey="__total"
            name="Total Fleet"
            type="monotone"
            stroke="#ffffff"
            strokeWidth={2.5}
            strokeDasharray="6 3"
            dot={false}
            connectNulls
            hide={!showTotal}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
