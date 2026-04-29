import { Loader2, AlertTriangle, RotateCw, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Une tuile dans la grille VNC Wall. La forme est dictée par `state`.
 *
 * Props:
 *  - device: { udid, name, status }  // status est le device status (OFFLINE, ...)
 *  - state: 'OFFLINE' | 'STARTING' | 'READY' | 'FAILED'
 *  - vncUrl?: string
 *  - error?: string
 *  - onRetry?: () => void
 */
export default function WallTile({ device, state, vncUrl, error, onRetry }) {
  const baseCls = 'relative w-full aspect-[9/19.5] rounded-lg overflow-hidden border'

  if (state === 'OFFLINE') {
    return (
      <div className={`${baseCls} bg-[#0A0A0A] border-[#1a1a1a] flex flex-col items-center justify-center text-[#52525B]`}>
        <Smartphone className="w-8 h-8 mb-2" />
        <p className="text-xs font-medium">{device.name || device.udid}</p>
        <p className="text-xs mt-1">Hors ligne</p>
      </div>
    )
  }

  if (state === 'STARTING') {
    return (
      <div className={`${baseCls} bg-[#0A0A0A] border-[#1a1a1a] flex flex-col items-center justify-center text-[#A1A1AA]`}>
        <Loader2 className="w-6 h-6 animate-spin mb-3 text-[#3B82F6]" />
        <p className="text-xs font-medium text-[#FAFAFA]">{device.name || device.udid}</p>
        <p className="text-xs mt-1 text-[#52525B]">Démarrage TrollVNC...</p>
      </div>
    )
  }

  if (state === 'FAILED') {
    return (
      <div className={`${baseCls} bg-[#EF4444]/5 border-[#EF4444]/30 flex flex-col items-center justify-center px-3 text-center`}>
        <AlertTriangle className="w-6 h-6 mb-2 text-[#EF4444]" />
        <p className="text-xs font-medium text-[#FAFAFA] mb-1">{device.name || device.udid}</p>
        <p className="text-xs text-[#A1A1AA] mb-3 line-clamp-3">{error || 'Erreur inconnue'}</p>
        {onRetry && (
          <Button size="sm" variant="outline" className="h-7 text-xs border-[#1a1a1a]" onClick={onRetry}>
            <RotateCw className="w-3 h-3 mr-1" /> Retry
          </Button>
        )}
      </div>
    )
  }

  // READY
  return (
    <div className={`${baseCls} bg-black border-[#1a1a1a] hover:border-[#3B82F6]/50 group`}>
      <iframe
        src={vncUrl}
        title={`noVNC ${device.name || device.udid}`}
        className="w-full h-full border-0"
        allow="clipboard-read; clipboard-write"
      />
      {/* Overlay with name (pointer-events-none pour ne pas bloquer les clics VNC) */}
      <div className="absolute top-0 inset-x-0 px-3 py-1.5 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <p className="text-xs font-medium text-[#FAFAFA] truncate">{device.name || device.udid}</p>
      </div>
    </div>
  )
}
