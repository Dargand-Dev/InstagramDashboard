import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useManualControlStore } from '@/stores/manualControlStore'
import { useWallControl } from '@/hooks/useWallControl'

/**
 * Banner persistant en haut du layout, affiché quand une session VNC Wall est
 * en cours et que l'utilisateur navigue hors de la page Wall.
 */
export default function WallBanner() {
  const navigate = useNavigate()
  const location = useLocation()
  const sessions = useManualControlStore((s) => s.sessions)
  const walling = useManualControlStore((s) => s.walling)
  const wallActive = useManualControlStore((s) => s.wallActive)
  const { releaseAll, isReleasing } = useWallControl()

  const sessionCount = Object.keys(sessions).length
  const wallingCount = Object.keys(walling).length
  const onWallPage = location.pathname === '/devices/wall'

  // Affichage pendant TOUT le cycle (incl. STARTING avant que les sessions arrivent),
  // mais évidemment pas sur la page wall elle-même.
  if (!wallActive || (sessionCount === 0 && wallingCount === 0) || onWallPage) return null

  const totalCount = Math.max(sessionCount, wallingCount)
  const isStartingPhase = sessionCount === 0

  return (
    <div className="bg-[#3B82F6]/10 border-b border-[#3B82F6]/20 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse" />
        <span className="text-xs font-medium text-[#FAFAFA]">
          VNC Wall {isStartingPhase ? 'démarrage' : 'actif'}
        </span>
        <span className="text-xs text-[#A1A1AA]">· {totalCount} device{totalCount !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10"
          onClick={() => navigate('/devices/wall')}
        >
          <LayoutGrid className="w-3 h-3 mr-1" /> Voir la grille
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-[#A1A1AA] hover:text-[#FAFAFA]"
          disabled={isReleasing}
          onClick={() => releaseAll()}
        >
          {isReleasing ? 'Release...' : 'Release All'}
        </Button>
      </div>
    </div>
  )
}
