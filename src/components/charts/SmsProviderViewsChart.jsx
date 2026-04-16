import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList, Cell,
} from 'recharts'
import { viewsByProvider } from '@/utils/analyticsScoring'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { tooltipStyle, formatNumber } from './chartHelpers'

const PROVIDER_COLORS = {
  DaisySMS: '#f59e0b',
  Getatext: '#3b82f6',
  SmsPool: '#10b981',
  VerifySMS: '#8b5cf6',
  Unknown: '#555',
}

const MIN_AGE_OPTIONS = [3, 5, 7, 14, 30]

export default function SmsProviderViewsChart({ snapshots, accounts, minAgeDays, onMinAgeChange }) {
  const data = useMemo(() => {
    if (!snapshots?.length || !accounts?.length) return []
    return viewsByProvider(snapshots, accounts, { minAgeDays })
  }, [snapshots, accounts, minAgeDays])

  const totalIncluded = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data])

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <span className="label-upper block">Avg Views by SMS Provider</span>
          <p className="text-[10px] text-[#444] mt-0.5">
            Latest snapshot · {totalIncluded} accounts included (min age {minAgeDays}d)
          </p>
        </div>
        <Select value={String(minAgeDays)} onValueChange={(v) => onMinAgeChange(Number(v))}>
          <SelectTrigger className="w-[140px] text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] h-8">
            <SelectValue placeholder="Min age" />
          </SelectTrigger>
          <SelectContent className="bg-[#111111] border-[#1a1a1a]">
            {MIN_AGE_OPTIONS.map((days) => (
              <SelectItem key={days} value={String(days)} className="text-xs text-[#FAFAFA]">
                Min age {days}d
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-[#333] text-xs">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ left: 10, top: 20 }}>
            <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
            <XAxis
              dataKey="provider"
              tick={{ fill: '#999', fontSize: 11 }}
              axisLine={{ stroke: '#1a1a1a' }}
              tickLine={false}
            />
            <YAxis tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} tickFormatter={formatNumber} />
            <Tooltip
              {...tooltipStyle}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              formatter={(v, name, item) => {
                if (name === 'meanViews') {
                  const count = item?.payload?.count
                  return [`${formatNumber(v)} (${count} accounts)`, 'Avg views']
                }
                return [formatNumber(v), name]
              }}
            />
            <Bar dataKey="meanViews" name="Avg views" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.provider} fill={PROVIDER_COLORS[entry.provider] || '#3b82f6'} />
              ))}
              <LabelList
                dataKey="count"
                position="top"
                fill="#666"
                fontSize={10}
                formatter={(v) => `n=${v}`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
