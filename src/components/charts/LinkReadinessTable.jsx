import { useMemo } from 'react'
import { Link2Off } from 'lucide-react'
import { Blur } from '@/contexts/IncognitoContext'
import { linkReadinessScore } from '@/utils/analyticsScoring'
import { formatNumber } from './chartHelpers'

function StabilityBadge({ value }) {
  if (value == null) return <span className="text-[#555]">—</span>
  const pct = Math.round(value * 100)
  const color = pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400'
  return <span className={`font-mono ${color}`}>{pct}%</span>
}

export default function LinkReadinessTable({ snapshots, accounts, windowDays = 14, onEditLink, topN = 20 }) {
  const rows = useMemo(() => {
    if (!snapshots?.length || !accounts?.length) return []
    return linkReadinessScore(snapshots, accounts, { windowDays }).slice(0, topN)
  }, [snapshots, accounts, windowDays, topN])

  return (
    <div>
      <span className="label-upper block">Link Readiness · Accounts ready for a story link</span>
      <p className="text-[10px] text-[#444] mt-0.5 mb-4">
        Composite score = total views × stability over last {windowDays}d · click a row to add a link
      </p>

      <div className="overflow-hidden rounded-md border border-[#1a1a1a]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Username</th>
              <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Total Views</th>
              <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Daily Mean</th>
              <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Stability</th>
              <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-[#333]">No accounts without a link meet the criteria</td></tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.username}
                  className="border-b border-[#141414] last:border-0 hover:bg-[#111] transition-colors cursor-pointer"
                  onClick={() => onEditLink?.(row.username)}
                >
                  <td className="px-3 py-2.5 text-white font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Blur>{row.username}</Blur>
                      <Link2Off size={12} className="text-red-500" />
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#ccc]">{formatNumber(row.totalViews)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#ccc]">{formatNumber(Math.round(row.dailyMean))}/d</td>
                  <td className="px-3 py-2.5 text-right"><StabilityBadge value={row.stability} /></td>
                  <td className="px-3 py-2.5 text-right font-mono text-blue-400">{formatNumber(Math.round(row.score))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
