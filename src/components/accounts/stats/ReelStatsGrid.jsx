import { useState, useMemo } from 'react'
import { ArrowDownAZ } from 'lucide-react'
import AccountStatsCard from './AccountStatsCard'

const SORT_OPTIONS = [
  { key: 'views', label: 'Most views' },
  { key: 'likes', label: 'Most likes' },
  { key: 'reels', label: 'Most reels' },
  { key: 'recent', label: 'Recently fetched' },
]

export default function ReelStatsGrid({ summaries, onAccountClick }) {
  const [sortKey, setSortKey] = useState('views')

  const sorted = useMemo(() => {
    const arr = [...summaries]
    switch (sortKey) {
      case 'views':
        return arr.sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0))
      case 'likes':
        return arr.sort((a, b) => (b.totalLikes || 0) - (a.totalLikes || 0))
      case 'reels':
        return arr.sort((a, b) => (b.totalReels || 0) - (a.totalReels || 0))
      case 'recent':
        return arr.sort((a, b) => {
          const ta = a.lastFetchedAt ? new Date(a.lastFetchedAt).getTime() : 0
          const tb = b.lastFetchedAt ? new Date(b.lastFetchedAt).getTime() : 0
          return tb - ta
        })
      default:
        return arr
    }
  }, [summaries, sortKey])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[#666] text-xs">{summaries.length} accounts with reel data</span>
        <div className="flex items-center gap-2">
          <ArrowDownAZ size={14} className="text-[#555]" />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[#333]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {sorted.map((s) => (
          <AccountStatsCard
            key={s.username}
            summary={s}
            onClick={() => onAccountClick(s.username)}
          />
        ))}
      </div>
    </div>
  )
}
