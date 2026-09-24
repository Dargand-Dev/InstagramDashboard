import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Power, RotateCw } from 'lucide-react'
import {
  useBackendRestartStatus, useRestartBackend, RESTART_IN_PROGRESS, isLocalBrowser,
} from '@/hooks/useBackendRestart'

const PHASE_BADGES = {
  stopping: { label: 'Arrêt…', className: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20' },
  starting: { label: 'Démarrage…', className: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20' },
  up: { label: 'Relancé', className: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20' },
  failed: { label: 'Échec', className: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20' },
}

function formatTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString('fr-FR') : ''
}

function describe(status) {
  switch (status.phase) {
    case 'stopping': return `Arrêt du processus sur le port ${status.port}…`
    case 'starting': return `${status.startCommand} : compilation puis démarrage…`
    case 'up': return `Relancé à ${formatTime(status.finishedAt)}`
    case 'failed': return `Échec à ${formatTime(status.finishedAt)}`
    default: return `Port ${status.port} · ${status.startCommand}`
  }
}

/** Ligne « Backend Spring Boot » de la carte System : redémarrage via le serveur de dev Vite. */
export default function BackendRestartControl() {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { data: status, error } = useBackendRestartStatus()
  const restart = useRestartBackend()
  const phase = status?.phase ?? 'idle'
  const inProgress = RESTART_IN_PROGRESS.has(phase)
  const badge = PHASE_BADGES[phase]

  // Toast sur une fin de redémarrage suivie depuis la page, pas sur l'état trouvé au montage
  const previousPhase = useRef(phase)
  useEffect(() => {
    const previous = previousPhase.current
    previousPhase.current = phase
    if (!RESTART_IN_PROGRESS.has(previous)) return
    if (phase === 'up') {
      toast.success('Backend redémarré')
      // Relance les requêtes tombées pendant la coupure
      queryClient.invalidateQueries()
    } else if (phase === 'failed') {
      toast.error('Échec du redémarrage du backend', { description: status?.error })
    }
  }, [phase, status?.error, queryClient])

  if (!isLocalBrowser || error) {
    return (
      <p className="text-xs text-[#52525B]">
        Redémarrage du backend indisponible : {error?.message || 'ouvrez le dashboard sur localhost'}.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Power className="w-3.5 h-3.5 text-[#52525B]" />
            <span className="text-xs text-[#A1A1AA]">Backend Spring Boot</span>
            {badge && (
              <Badge variant="outline" className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
            )}
          </div>
          {status && <p className="text-xs text-[#52525B] mt-1 truncate">{describe(status)}</p>}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-[#27272A] text-[#FAFAFA] hover:bg-[#1a1a1a]"
          disabled={!status || inProgress || restart.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          <RotateCw className={`w-3 h-3 mr-1 ${inProgress ? 'animate-spin' : ''}`} />
          Redémarrer
        </Button>
      </div>

      {phase === 'failed' && (
        <div className="rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/5 p-3 space-y-2">
          <p className="text-xs text-[#EF4444]">{status.error}</p>
          {status.logTail && (
            <pre className="max-h-48 overflow-auto rounded bg-[#0A0A0A] p-2 text-[10px] leading-4 text-[#A1A1AA] font-mono whitespace-pre-wrap break-all">
              {status.logTail}
            </pre>
          )}
          <p className="text-[10px] text-[#52525B] font-mono break-all">{status.logFile}</p>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-[#111111] border-[#1a1a1a] text-[#FAFAFA] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Redémarrer le backend ?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-[#A1A1AA]">
            <p>
              Le processus qui écoute sur le port {status?.port} sera arrêté, puis relancé avec{' '}
              <code className="font-mono text-xs text-[#FAFAFA]">{status?.startCommand}</code> (le code est recompilé).
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Les tâches en cours et en file d'attente seront annulées.</li>
              <li>
                L'auto-création globale reprendra sa valeur de démarrage
                (<code className="font-mono">auto-creation.global-enabled</code>).
              </li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)} className="text-[#A1A1AA]">
              Annuler
            </Button>
            <Button
              size="sm"
              className="bg-[#F59E0B] hover:bg-[#D97706] text-black"
              disabled={restart.isPending}
              onClick={() => restart.mutate(undefined, { onSettled: () => setConfirmOpen(false) })}
            >
              {restart.isPending ? 'Envoi…' : 'Redémarrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
