import { useState } from 'react'
import { Hand, X } from 'lucide-react'
import { useManualControlStore } from '@/stores/manualControlStore'
import { useManualControl } from '@/hooks/useManualControl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import TimeAgo from '@/components/shared/TimeAgo'

/**
 * Overlay plein écran affiché tant qu'**exactement une** session est active et
 * que la VNC Wall n'est pas en cours. Si plusieurs sessions existent OU si la
 * wall est active, on laisse la page Wall (ou son banner) gérer l'UI.
 */
export default function ManualControlOverlay() {
  const sessions = useManualControlStore((s) => s.sessions)
  const wallActive = useManualControlStore((s) => s.wallActive)
  const sessionList = Object.values(sessions)
  const { release, isReleasing } = useManualControl()
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Affiché uniquement quand une seule session est active, hors wall
  if (wallActive || sessionList.length !== 1) return null
  const active = sessionList[0]

  return (
    <>
      <Dialog open={true} modal>
        <DialogContent
          showCloseButton={false}
          className="bg-[#0A0A0A] border-[#1a1a1a] w-[96vw] sm:max-w-[96vw] h-[94vh] max-h-[94vh] flex flex-col p-0 gap-0 [&>button]:hidden"
        >
          {/* Header */}
          <div className="border-b border-[#1a1a1a] px-5 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
                <span className="text-xs font-semibold text-[#EF4444] uppercase tracking-wide">Manual mode</span>
              </div>
              <span className="text-sm text-[#FAFAFA] font-medium">{active.deviceName}</span>
              <span className="text-xs text-[#52525B] font-mono">{active.deviceIp}</span>
              <span className="text-xs text-[#52525B]">
                · depuis <TimeAgo date={active.since} />
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmOpen(true)}
              disabled={isReleasing}
              className="text-[#A1A1AA] hover:text-[#FAFAFA]"
            >
              <X className="w-4 h-4 mr-1" />
              Release
            </Button>
          </div>

          {/* Body : iframe noVNC */}
          <iframe
            src={active.vncUrl}
            title={`noVNC ${active.deviceName}`}
            className="flex-1 w-full border-0 bg-black"
            allow="clipboard-read; clipboard-write"
          />
        </DialogContent>
      </Dialog>

      {/* Confirmation release */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-[#0A0A0A] border-[#1a1a1a]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#FAFAFA]">Release manual control ?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A1A1AA]">
              La connexion VNC sera fermée. La queue n'est pas affectée — elle continue à dispatcher des tâches normalement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#111111] border-[#1a1a1a] text-[#A1A1AA]">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isReleasing}
              onClick={() => {
                release(active.udid, {
                  onSuccess: () => setConfirmOpen(false),
                })
              }}
            >
              <Hand className="w-3.5 h-3.5 mr-1.5" />
              Release
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
