import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

function formatNumber(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#fff', fontWeight: 600 }}>{formatNumber(payload[0]?.value)}</div>
    </div>
  )
}

export default function AccountDailyViewsChart({ account, snapshots }) {
  const chartData = useMemo(() => {
    if (!snapshots?.length || !account?.username) return []

    const username = account.username

    const dateDaysAgo = (dateStr, n) => {
      const d = new Date(dateStr + 'T00:00:00')
      d.setDate(d.getDate() - n)
      return d.toISOString().slice(0, 10)
    }

    // Group snapshots for this account by day, keep latest per day
    const dayMap = {}
    for (const snap of snapshots) {
      if (!snap.snapshotAt || snap.username !== username) continue
      const day = snap.snapshotAt.slice(0, 10)
      if (!dayMap[day] || snap.snapshotAt > dayMap[day].at) {
        dayMap[day] = { at: snap.snapshotAt, val: snap.viewsLast30Days || 0 }
      }
    }

    const days = Object.keys(dayMap).sort()
    if (!days.length) return []

    // Compute daily views using rolling window delta
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

    // Last 30 days
    const displayDays = days.slice(-30)
    return displayDays.map(day => ({
      date: `${day.slice(8)}/${day.slice(5, 7)}`,
      views: computed[day] || 0
    }))
  }, [snapshots, account?.username])

  if (!chartData.length) {
    return (
      <div className="h-48 flex items-center justify-center text-[#333] text-xs">
        No view data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData}>
        <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#555', fontSize: 10 }}
          axisLine={{ stroke: '#1a1a1a' }}
          tickLine={false}
          interval="preserveStartEnd"
          angle={-30}
          textAnchor="end"
          height={40}
        />
        <YAxis
          tick={{ fill: '#555', fontSize: 11 }}
          axisLine={{ stroke: '#1a1a1a' }}
          tickLine={false}
          tickFormatter={formatNumber}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="views" fill="#3b82f6" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
