import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { CHART_COLORS } from '@/utils/chartColors'
import { useIncognito } from '@/contexts/IncognitoContext'
import { accountMomentumScore } from '@/utils/analyticsScoring'
import { tooltipStyle, formatNumber } from './chartHelpers'
import { BlurredYTick } from './chartPrimitives'

export default function TopPerformersChart({ snapshots, colorMap, windowDays = 7, topN = 20, onSelectUsername }) {
  const { isIncognito } = useIncognito()

  const data = useMemo(() => {
    if (!snapshots?.length) return []
    return accountMomentumScore(snapshots, { windowDays }).slice(0, topN)
  }, [snapshots, windowDays, topN])

  if (!data.length) {
    return (
      <div>
        <span className="label-upper block">Top Performers Right Now</span>
        <p className="text-[10px] text-[#444] mt-0.5 mb-4">Last {windowDays} days · independent of period filter · click row to inspect</p>
        <div className="h-64 flex items-center justify-center text-[#333] text-xs">No data</div>
      </div>
    )
  }

  const chartHeight = Math.max(260, data.length * 22)

  return (
    <div>
      <span className="label-upper block">Top Performers Right Now</span>
      <p className="text-[10px] text-[#444] mt-0.5 mb-4">Last {windowDays} days · independent of period filter · click row to inspect</p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} tickFormatter={formatNumber} />
          <YAxis type="category" dataKey="username" tick={<BlurredYTick />} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} width={110} interval={0} />
          <Tooltip
            {...tooltipStyle}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            formatter={(v, name) => {
              if (name === 'score') return [formatNumber(Math.round(v)), 'Momentum']
              if (name === 'recentDelta') return [formatNumber(Math.round(v)), 'Δ views 7d']
              return [formatNumber(v), name]
            }}
            labelFormatter={isIncognito ? () => '•••' : undefined}
          />
          <Bar
            dataKey="score"
            name="Momentum"
            radius={[0, 4, 4, 0]}
            barSize={16}
            onClick={(payload) => {
              const username = payload?.username
              if (username && onSelectUsername) onSelectUsername(username)
            }}
            style={onSelectUsername ? { cursor: 'pointer' } : undefined}
          >
            {data.map((entry, i) => {
              const color = colorMap?.[entry.username] || CHART_COLORS[i % CHART_COLORS.length]
              return <Cell key={entry.username} fill={color} />
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
