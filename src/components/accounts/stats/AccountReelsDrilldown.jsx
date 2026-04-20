import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Eye, Heart, Film, MessageCircle, AlertCircle } from 'lucide-react'
import { scraperGet } from '@/api/scraperClient'
import ReelCard from './ReelCard'

function formatNumber(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function MetricTile({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${color}22`, color }}
      >
        <Icon size={18} />
      </div>
      <div className="flex flex-col">
        <span className="text-[#555] text-xs uppercase tracking-wide">{label}</span>
        <span className="text-white text-xl font-semibold">{value}</span>
      </div>
    </div>
  )
}

export default function AccountReelsDrilldown({ username, onBack }) {
  const { data: reels, isLoading, error } = useQuery({
    queryKey: ['scraper-reel-stats-account', username],
    queryFn: () => scraperGet(`/analytics/legacy/reel-stats/accounts/${encodeURIComponent(username)}/reels`),
  })

  const totals = useMemo(() => {
    return (reels || []).reduce(
      (acc, r) => {
        acc.views += r.videoViewCount || 0
        acc.likes += r.likesCount || 0
        acc.comments += r.commentsCount || 0
        return acc
      },
      { views: 0, likes: 0, comments: 0 }
    )
  }, [reels])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2 text-sm text-[#888] hover:text-white hover:border-[#333] transition-colors"
        >
          <ChevronLeft size={14} />
          Back
        </button>
        <h2 className="text-white text-lg font-semibold">{username}</h2>
        <span className="text-[#555] text-xs">{reels?.length || 0} reels</span>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="text-red-300 text-sm font-medium">Failed to load reels</span>
            <span className="text-red-400/80 text-xs">{error.message}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricTile icon={Film} label="Reels" value={reels?.length || 0} color="#8B5CF6" />
        <MetricTile icon={Eye} label="Total views" value={formatNumber(totals.views)} color="#3B82F6" />
        <MetricTile icon={Heart} label="Total likes" value={formatNumber(totals.likes)} color="#EF4444" />
        <MetricTile icon={MessageCircle} label="Comments" value={formatNumber(totals.comments)} color="#22C55E" />
      </div>

      {isLoading && !error && <div className="text-center text-[#555] py-12">Loading reels...</div>}

      {!isLoading && !error && reels && reels.length === 0 && (
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-12 text-center">
          <p className="text-[#888] text-sm">No reels found for this account</p>
        </div>
      )}

      {!isLoading && !error && reels && reels.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {reels.map((reel) => (
            <ReelCard key={reel.shortCode} reel={reel} />
          ))}
        </div>
      )}
    </div>
  )
}
