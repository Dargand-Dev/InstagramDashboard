import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const tooltipStyle = {
  contentStyle: { backgroundColor: '#111', border: '1px solid #1a1a1a', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#999', marginBottom: 4 },
  itemStyle: { padding: '2px 0' },
}

function formatNumber(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

/**
 * Shows follower growth for a single account vs fleet average,
 * normalized by "days since account creation".
 *
 * Props:
 *   account    — the selected InstagramAccount (needs username, createdAt)
 *   accounts   — all accounts (need username, createdAt)
 *   snapshots  — all AccountStatsSnapshot[]
 */
export default function AccountGrowthChart({ account, accounts, snapshots }) {
  const chartData = useMemo(() => {
    if (!account?.createdAt || !snapshots?.length || !accounts?.length) return []

    // Helper: days between two dates
    const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86_400_000)

    // Build a map of username → createdAt
    const createdAtMap = {}
    for (const acc of accounts) {
      if (acc.createdAt) createdAtMap[acc.username] = new Date(acc.createdAt)
    }

    // Group snapshots by username → sorted by date
    const byUser = {}
    for (const snap of snapshots) {
      if (!createdAtMap[snap.username]) continue
      if (!byUser[snap.username]) byUser[snap.username] = []
      byUser[snap.username].push(snap)
    }

    // For each user, compute { day, followers } entries
    const userCurves = {}
    for (const [username, snaps] of Object.entries(byUser)) {
      const created = createdAtMap[username]
      userCurves[username] = snaps
        .map(s => ({
          day: daysBetween(created, s.snapshotAt),
          followers: s.followerCount || 0,
        }))
        .filter(d => d.day >= 0)
        .sort((a, b) => a.day - b.day)
    }

    // Selected account curve
    const selectedCurve = userCurves[account.username] || []
    if (!selectedCurve.length) return []

    // Others: aggregate by day bucket → average
    const otherUsers = Object.keys(userCurves).filter(u => u !== account.username)
    const dayBuckets = {} // day → { sum, count }
    for (const username of otherUsers) {
      for (const point of userCurves[username]) {
        if (!dayBuckets[point.day]) dayBuckets[point.day] = { sum: 0, count: 0 }
        dayBuckets[point.day].sum += point.followers
        dayBuckets[point.day].count += 1
      }
    }

    // Build the max day range from the selected account
    const maxDay = selectedCurve[selectedCurve.length - 1].day

    // Merge into a single dataset
    // For the selected account: use exact data points
    // For the average: interpolate between known day buckets
    const selectedMap = {}
    for (const p of selectedCurve) selectedMap[p.day] = p.followers

    // Get sorted average days for interpolation
    const avgDays = Object.keys(dayBuckets).map(Number).sort((a, b) => a - b)
    const avgPoints = avgDays.map(d => ({ day: d, avg: dayBuckets[d].sum / dayBuckets[d].count }))

    // Interpolate average for any day
    function interpolateAvg(day) {
      if (!avgPoints.length) return null
      if (day <= avgPoints[0].day) return avgPoints[0].avg
      if (day >= avgPoints[avgPoints.length - 1].day) return avgPoints[avgPoints.length - 1].avg
      // Find surrounding points
      for (let i = 0; i < avgPoints.length - 1; i++) {
        if (avgPoints[i].day <= day && avgPoints[i + 1].day >= day) {
          const range = avgPoints[i + 1].day - avgPoints[i].day
          if (range === 0) return avgPoints[i].avg
          const ratio = (day - avgPoints[i].day) / range
          return avgPoints[i].avg + ratio * (avgPoints[i + 1].avg - avgPoints[i].avg)
        }
      }
      return null
    }

    // Collect all unique days from both datasets
    const allDays = new Set([
      ...selectedCurve.map(p => p.day),
      ...avgDays.filter(d => d <= maxDay),
    ])
    const sortedDays = [...allDays].sort((a, b) => a - b)

    return sortedDays.map(day => ({
      day,
      followers: selectedMap[day] ?? null,
      average: otherUsers.length > 0 ? Math.round(interpolateAvg(day)) : null,
    }))
  }, [account, accounts, snapshots])

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-48 text-[#333] text-xs">
        No growth data available
      </div>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tick={{ fill: '#555', fontSize: 11 }}
            axisLine={{ stroke: '#1a1a1a' }}
            tickLine={false}
            label={{ value: 'Days since creation', position: 'insideBottom', offset: -2, fill: '#333', fontSize: 10 }}
          />
          <YAxis
            tick={{ fill: '#555', fontSize: 11 }}
            axisLine={{ stroke: '#1a1a1a' }}
            tickLine={false}
            tickFormatter={formatNumber}
            width={50}
          />
          <Tooltip
            {...tooltipStyle}
            labelFormatter={d => `Day ${d}`}
            formatter={(value, name) => [formatNumber(value), name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <Line
            type="monotone"
            dataKey="followers"
            name={account?.username || 'This account'}
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#3b82f6' }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="average"
            name="Fleet average"
            stroke="#555"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{ r: 3, fill: '#555' }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
