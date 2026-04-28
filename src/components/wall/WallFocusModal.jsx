import { X } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useManualControl } from '@/hooks/useManualControl'

/**
 * Modal grand format pour un seul device. Affiche une iframe noVNC live et un
 * bouton "Release ce device".
 *
 * Note v1 : la tuile en grille devient un placeholder pendant le focus, donc
 * une seule iframe par device à tout moment (TrollVNC est single-client).
 *
 * Props:
 *  - session: { udid, deviceName, deviceIp, vncUrl, since }
 *  - onClose: () => void
 */
export default function WallFocusModal({ session, onClose }) {
  const { release, isReleasing } = useManualControl()

  if (!session) return null

  const handleReleaseOne = () => {
    release(session.udid, {
      onSuccess: () => onClose(),
    })
  }

  return (
    <Dialog open={true} modal onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="bg-[#0A0A0A] border-[#1a1a1a] w-[96vw] sm:max-w-[96vw] h-[94vh] max-h-[94vh] flex flex-col p-0 gap-0 [&>button]:hidden"
      >
        {/* Header */}
        <div className="border-b border-[#1a1a1a] px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            <span className="text-sm text-[#FAFAFA] font-medium">{session.deviceName}</span>
            <span className="text-xs text-[#52525B] font-mono">{session.deviceIp}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReleaseOne}
              disabled={isReleasing}
              className="text-[#A1A1AA] hover:text-[#FAFAFA]"
              title="Release ce device uniquement (les autres tuiles restent actives)"
            >
              Release ce device
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="text-[#A1A1AA] hover:text-[#FAFAFA]"
            >
              <X className="w-4 h-4 mr-1" /> Fermer focus
            </Button>
          </div>
        </div>

        {/* Body : iframe noVNC live */}
        <iframe
          src={session.vncUrl}
          title={`noVNC ${session.deviceName}`}
          className="flex-1 w-full border-0 bg-black"
          allow="clipboard-read; clipboard-write"
        />
      </DialogContent>
    </Dialog>
  )
}
