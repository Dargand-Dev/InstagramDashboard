import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import LogViewer from '@/components/shared/LogViewer'
import { useRunLogsWithLive } from '@/hooks/useRunLogsWithLive'
import { extractAccountLog, hasAccountSentinels } from '@/utils/parseAccountLogs'
import { Terminal, Square, SkullIcon, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function AccountLogModal({ runId, username, open, onClose }) {
  const queryClient = useQueryClient()
  const { text, isLoading, isError, isActive, showingLive, liveConnected } =
    useRunLogsWithLive(runId, { enabled: open })

  const [killDialogOpen, setKillDialogOpen] = useState(false)

  const filteredText = useMemo(
    () => extractAccountLog(text, username, { includeContext: true }),
    [text, username],
  )

  // Run pré-fonctionnalité : pas de sentinelles → on ne peut pas filtrer.
  // On suppress le banner pendant un run live tant qu'aucune sentinelle n'est
  // arrivée (le BEGIN peut juste ne pas avoir streamé encore — le banner
  // apparaîtrait à tort dans cette fenêtre courte).
  const noSentinels = !!text && !hasAccountSentinels(text) && !showingLive

  const stopGraceful = useMutation({
    mutationFn: () => apiPost(`/api/automation/runs/${encodeURIComponent(runId)}/stop`, { mode: 'GRACEFUL' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-runs'] })
      toast.success('Arrêt demandé — la run se terminera après les étapes en cours')
    },
    onError: (err) => toast.error(err.message || 'Échec de l\'arrêt'),
  })

  const killImmediate = useMutation({
    mutationFn: () => apiPost(`/api/automation/runs/${encodeURIComponent(runId)}/stop`, { mode: 'IMMEDIATE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-runs'] })
      toast.success('Run killed')
      setKillDialogOpen(false)
    },
    onError: (err) => {
      toast.error(err.message || 'Kill a échoué')
      setKillDialogOpen(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="bg-[#0A0A0A] border border-[#1a1a1a] sm:max-w-5xl w-[calc(100%-2rem)] max-h-[85vh] flex flex-col overflow-hidden"
        showCloseButton
      >
        <DialogHeader className="border-b border-[#1a1a1a] pb-3">
          <div className="flex items-center justify-between pr-8 gap-3 flex-wrap">
            <DialogTitle className="text-[#FAFAFA] flex items-center gap-2 text-sm">
              <Terminal className="w-4 h-4 text-[#A1A1AA]" />
              Logs — <span className="text-[#3B82F6]">{username}</span>
              <span className="text-[#52525B] text-xs font-mono">· {runId}</span>
              {showingLive ? (
                <Badge variant="outline" className="bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20 text-[10px] gap-1">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full bg-[#22C55E] ${liveConnected ? 'animate-pulse' : 'opacity-50'}`} />
                  Live
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-[#52525B]/10 text-[#A1A1AA] border-[#52525B]/20 text-[10px]">
                  Completed
                </Badge>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {isActive && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-[#F59E0B] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10"
                    onClick={() => stopGraceful.mutate()}
                    disabled={stopGraceful.isPending}
                  >
                    <Square className="w-3 h-3 mr-1" />
                    Stop Gracefully
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                    onClick={() => setKillDialogOpen(true)}
                  >
                    <SkullIcon className="w-3 h-3 mr-1" />
                    Kill
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {noSentinels && (
          <div className="flex items-start gap-2 px-3 py-2 mt-3 rounded-lg border border-[#F59E0B]/20 bg-[#F59E0B]/5 text-xs text-[#F59E0B]">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Aucun marqueur de compte trouvé — ce run est antérieur à la fonctionnalité.
              Les lignes affichées correspondent au contexte global du run uniquement.
            </span>
          </div>
        )}

        <div className="flex-1 min-h-0 pt-3">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full bg-[#111111]" />
              ))}
            </div>
          ) : isError || !filteredText ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-xs text-[#52525B]">
                {showingLive ? 'En attente des premières lignes…' : 'Pas de logs disponibles pour ce compte.'}
              </p>
            </div>
          ) : (
            <LogViewer
              text={filteredText}
              follow={showingLive}
              height={Math.min(600, window.innerHeight * 0.65)}
            />
          )}
        </div>

        <Dialog open={killDialogOpen} onOpenChange={setKillDialogOpen}>
          <DialogContent className="bg-[#111111] border-[#1a1a1a] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#FAFAFA]">Kill Execution?</DialogTitle>
              <DialogDescription className="text-[#52525B]">
                This will immediately terminate the execution. Any in-progress actions may leave accounts in an inconsistent state.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="ghost" className="text-[#A1A1AA]" />}>
                Cancel
              </DialogClose>
              <Button
                className="bg-[#EF4444] hover:bg-[#DC2626] text-white"
                onClick={() => killImmediate.mutate()}
                disabled={killImmediate.isPending}
              >
                Kill Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
