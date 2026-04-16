import { useState } from 'react'
import { Eye, Heart, Film, MessageCircle } from 'lucide-react'
import TimeAgo from '../../shared/TimeAgo'

function formatNumber(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function statusColor(status) {
  switch (status) {
    case 'ACTIVE': return 'bg-emerald-500'
    case 'BANNED': return 'bg-red-500'
    case 'SUSPENDED': return 'bg-amber-500'
    case 'ERROR': return 'bg-orange-500'
    default: return 'bg-gray-500'
  }
}

function Thumbnail({ path }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <div className="w-full h-full bg-[#0a0a0a]" />
  }
  return (
    <img
      src={`/api/reel-thumbnails/${path}`}
      alt=""
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}

export default function AccountStatsCard({ summary, onClick }) {
  const { username, accountStatus, totalReels, totalViews, totalLikes, totalComments, avgViewsPerReel, lastFetchedAt, recentThumbnails } = summary

  return (
    <button
      onClick={onClick}
      className="flex flex-col bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 text-left hover:border-[#333] hover:bg-[#0f0f0f] transition-colors"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
          {username.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-semibold truncate">{username}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${statusColor(accountStatus)}`} />
          </div>
          <span className="text-[#555] text-xs">
            {lastFetchedAt ? <TimeAgo date={lastFetchedAt} /> : 'Never fetched'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Film size={12} className="text-[#666]" />
          <span className="text-white text-sm font-medium">{totalReels}</span>
          <span className="text-[#555] text-[10px]">reels</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Eye size={12} className="text-[#666]" />
          <span className="text-white text-sm font-medium">{formatNumber(totalViews)}</span>
          <span className="text-[#555] text-[10px]">views</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Heart size={12} className="text-[#666]" />
          <span className="text-white text-sm font-medium">{formatNumber(totalLikes)}</span>
          <span className="text-[#555] text-[10px]">likes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MessageCircle size={12} className="text-[#666]" />
          <span className="text-white text-sm font-medium">{formatNumber(totalComments)}</span>
          <span className="text-[#555] text-[10px]">comments</span>
        </div>
      </div>

      {recentThumbnails && recentThumbnails.length > 0 && (
        <div className="grid grid-cols-4 gap-1 mt-auto">
          {recentThumbnails.slice(0, 4).map((path) => (
            <div
              key={path}
              className="aspect-square bg-[#111] rounded overflow-hidden border border-[#1a1a1a]"
            >
              <Thumbnail path={path} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-[#141414] text-[10px] text-[#555]">
        Avg {formatNumber(Math.round(avgViewsPerReel))} views per reel
      </div>
    </button>
  )
}
