import { useState, useEffect } from 'react'
import { Eye, Heart, MessageCircle, Pin, Film } from 'lucide-react'

function formatNumber(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

export default function ReelCard({ reel }) {
  const [imageFailed, setImageFailed] = useState(false)

  // Reset failure state when the reel changes (sort/refresh/drill-in)
  useEffect(() => {
    setImageFailed(false)
  }, [reel.shortCode, reel.thumbnailPath])

  const handleClick = () => {
    if (reel.url) {
      window.open(reel.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <button
      onClick={handleClick}
      className="group relative flex flex-col bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden text-left hover:border-[#333] transition-colors"
    >
      <div className="relative aspect-[9/16] bg-[#111]">
        {reel.thumbnailPath && !imageFailed ? (
          <img
            src={reel.thumbnailPath.startsWith('http') ? reel.thumbnailPath : `/api/reel-thumbnails/${reel.thumbnailPath}`}
            alt={reel.caption ? `Reel: ${reel.caption.slice(0, 60)}` : `Reel ${reel.shortCode}`}
            className="w-full h-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#333]">
            <Film size={32} />
          </div>
        )}

        {reel.isPinned && (
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm rounded-full p-1.5">
            <Pin size={10} className="text-white" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2">
          <div className="flex items-center gap-2 text-white text-[10px]">
            <span className="flex items-center gap-0.5">
              <Eye size={10} />
              {formatNumber(reel.videoViewCount)}
            </span>
            <span className="flex items-center gap-0.5">
              <Heart size={10} />
              {formatNumber(reel.likesCount)}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageCircle size={10} />
              {formatNumber(reel.commentsCount)}
            </span>
          </div>
        </div>
      </div>

      {reel.caption && (
        <div className="p-2 text-[#888] text-[10px] line-clamp-2 min-h-[2.4rem]">
          {reel.caption}
        </div>
      )}
    </button>
  )
}
