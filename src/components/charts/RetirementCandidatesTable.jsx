import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Blur } from '@/contexts/IncognitoContext'
import { retirementScore } from '@/utils/analyticsScoring'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { formatNumber } from './chartHelpers'

const MIN_AGE_OPTIONS = [14, 30, 45, 60, 90]

export default function RetirementCandidatesTable({
  snapshots,
  accounts,
  minAgeDays,
  onMinAgeChange,
  dailyViewsThreshold = 100,
  onSelectUsername,
  topN = 30,
}) {
  const rows = useMemo(() => {
    if (!snapshots?.length || !accounts?.length) return []
    return retirementScore(snapshots, accounts, { minAgeDays, dailyViewsThreshold }).slice(0, topN)
  }, [snapshots, accounts, minAgeDays, dailyViewsThreshold, topN])

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <span className="label-upper block">Underperforming Accounts · Retirement Candidates</span>
          <p className="text-[10px] text-[#444] mt-0.5">
            Flagged: age &gt; {minAgeDays}d AND avg &lt; {dailyViewsThreshold} views/day over last 14d · click to inspect
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

      <div className="overflow-hidden rounded-md border border-[#1a1a1a]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Username</th>
              <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Age</th>
              <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Daily Avg (14d)</th>
              <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Retire Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-[#333]">No accounts match the retirement criteria</td></tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.username}
                  className="border-b border-[#141414] last:border-0 hover:bg-[#111] transition-colors cursor-pointer"
                  onClick={() => onSelectUsername?.(row.username)}
                >
                  <td className="px-3 py-2.5 text-white font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Blur>{row.username}</Blur>
                      <AlertTriangle size={12} className="text-amber-500" />
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#ccc]">{row.ageDays}d</td>
                  <td className="px-3 py-2.5 text-right font-mono text-red-400">{formatNumber(Math.round(row.dailyMean))}/d</td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-400">{formatNumber(Math.round(row.score))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
