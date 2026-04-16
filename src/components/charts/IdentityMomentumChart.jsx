import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { CHART_COLORS } from '@/utils/chartColors'
import { useIncognito } from '@/contexts/IncognitoContext'
import { identityAvgViewsPerAccount } from '@/utils/analyticsScoring'
import { tooltipStyle, formatNumber } from './chartHelpers'
import { BlurredXTick } from './chartPrimitives'

export default function IdentityMomentumChart({ snapshots, usernameToIdentity, identityColorMap, windowDays = 7, isLoading, error }) {
  const { isIncognito } = useIncognito()

  const data = useMemo(() => {
    if (!snapshots?.length || !usernameToIdentity || Object.keys(usernameToIdentity).length === 0) return []
    return identityAvgViewsPerAccount(snapshots, usernameToIdentity, { windowDays })
  }, [snapshots, usernameToIdentity, windowDays])

  if (isLoading) {
    return (
      <div>
        <span className="label-upper block">Avg Views / Account</span>
        <p className="text-[10px] text-[#444] mt-0.5 mb-4">Last {windowDays} days · per-account average</p>
        <div className="h-64 flex items-center justify-center text-[#333] text-xs">Loading identities…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <span className="label-upper block">Avg Views / Account</span>
        <p className="text-[10px] text-[#444] mt-0.5 mb-4">Last {windowDays} days · per-account average</p>
        <div className="h-64 flex items-center justify-center text-[#333] text-xs">Identity data unavailable</div>
      </div>
    )
  }

  if (!data.length) {
    return (
      <div>
        <span className="label-upper block">Avg Views / Account</span>
        <p className="text-[10px] text-[#444] mt-0.5 mb-4">Last {windowDays} days · per-account average</p>
        <div className="h-64 flex items-center justify-center text-[#333] text-xs">No data</div>
      </div>
    )
  }

  return (
    <div>
      <span className="label-upper block">Avg Views / Account</span>
      <p className="text-[10px] text-[#444] mt-0.5 mb-4">Last {windowDays} days · per-account average · top 3 highlighted</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ left: 10, top: 10 }}>
          <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
          <XAxis dataKey="identity" tick={<BlurredXTick />} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} interval={0} angle={-25} textAnchor="end" height={60} />
          <YAxis tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} tickFormatter={formatNumber} />
          <Tooltip
            {...tooltipStyle}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            formatter={(v) => [formatNumber(Math.round(v)), 'Avg Views / Account']}
            labelFormatter={isIncognito ? () => '•••' : undefined}
          />
          <Bar dataKey="avgViewsPerAccount" name="Avg Views / Account" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => {
              const baseColor = identityColorMap?.[entry.identity] || CHART_COLORS[i % CHART_COLORS.length]
              const isTop3 = i < 3
              return (
                <Cell
                  key={entry.identity}
                  fill={baseColor}
                  fillOpacity={isTop3 ? 1 : 0.45}
                  stroke={isTop3 ? '#fff' : 'none'}
                  strokeWidth={isTop3 ? 1 : 0}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
