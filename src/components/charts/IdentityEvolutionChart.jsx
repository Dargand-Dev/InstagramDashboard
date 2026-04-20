import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS } from '@/utils/chartColors'
import { Blur, useIncognito } from '@/contexts/IncognitoContext'
import { viewsPerAccountByIdentityOverTime } from '@/utils/analyticsScoring'
import { formatNumber } from './chartHelpers'

function IdentityTooltip({ active, payload, label, identityColorMap, isIncognito }) {
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
            backgroundColor: identityColorMap?.[item.dataKey] || '#fff',
            flexShrink: 0,
          }} />
          <span style={{ color: '#ccc', filter: isIncognito ? 'blur(5px)' : 'none' }}>{item.dataKey}</span>
          <span style={{ color: '#fff', marginLeft: 'auto', fontWeight: 600 }}>{formatNumber(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function IdentityEvolutionChart({ snapshots, usernameToIdentity, identityColorMap, titleSuffix, isLoading, error }) {
  const { isIncognito } = useIncognito()

  const { rows, identityNames } = useMemo(() => {
    if (!snapshots?.length || !usernameToIdentity || Object.keys(usernameToIdentity).length === 0) {
      return { rows: [], identityNames: [] }
    }
    return viewsPerAccountByIdentityOverTime(snapshots, usernameToIdentity, { bucket: 'snapshot' })
  }, [snapshots, usernameToIdentity])

  const [selected, setSelected] = useState(null)

  const activeSet = useMemo(() => {
    if (selected !== null) return selected
    return new Set(identityNames.slice(0, 8))
  }, [selected, identityNames])

  const toggle = (identity) => {
    setSelected(prev => {
      const s = new Set(prev ?? activeSet)
      if (s.has(identity)) s.delete(identity)
      else s.add(identity)
      return s
    })
  }

  const selectAll = () => setSelected(new Set(identityNames))
  const selectNone = () => setSelected(new Set())

  const formatTick = (ts) => {
    const d = new Date(ts)
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mi = String(d.getUTCMinutes()).padStart(2, '0')
    return `${dd}/${mm} ${hh}:${mi}`
  }

  if (isLoading) {
    return (
      <div>
        <span className="label-upper block mb-4">Identity Evolution ({titleSuffix}) · Avg Views / Account</span>
        <div className="h-64 flex items-center justify-center text-[#333] text-xs">Loading identities…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <span className="label-upper block mb-4">Identity Evolution ({titleSuffix}) · Avg Views / Account</span>
        <div className="h-64 flex items-center justify-center text-[#333] text-xs">Identity data unavailable</div>
      </div>
    )
  }

  if (!rows.length || !identityNames.length) {
    return (
      <div>
        <span className="label-upper block mb-4">Identity Evolution ({titleSuffix}) · Avg Views / Account</span>
        <div className="h-64 flex items-center justify-center text-[#333] text-xs">No data</div>
      </div>
    )
  }

  return (
    <div>
      <span className="label-upper block mb-3">Identity Evolution ({titleSuffix}) · Avg Views / Account</span>

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
        {identityNames.map((identity, i) => {
          const color = identityColorMap?.[identity] || CHART_COLORS[i % CHART_COLORS.length]
          const active = activeSet.has(identity)
          return (
            <button
              key={identity}
              onClick={() => toggle(identity)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                active ? '' : 'border-[#1a1a1a] text-[#555] opacity-60'
              }`}
              style={active ? { borderColor: color, color: 'white' } : undefined}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <Blur>{identity}</Blur>
            </button>
          )
        })}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={rows}>
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
          <Tooltip content={<IdentityTooltip identityColorMap={identityColorMap} isIncognito={isIncognito} />} labelFormatter={formatTick} />
          {identityNames.map((identity, i) => (
            <Line
              key={identity}
              type="basis"
              dataKey={identity}
              stroke={identityColorMap?.[identity] || CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
              hide={!activeSet.has(identity)}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
