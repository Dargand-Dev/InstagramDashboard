import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api'
import { useManualControlStore } from '@/stores/manualControlStore'

/**
 * Hook orchestrant la VNC Wall — uniquement les mutations.
 *
 * La subscription STOMP au topic /topic/wall/status est centralisée dans
 * <ManualControlBootstrapper /> (singleton) pour éviter les double-subscribes
 * quand plusieurs composants utilisent ce hook (VncWall, WallBanner...).
 *
 * - startWall(udids?) : déclenche le démarrage en bulk côté backend.
 * - releaseAll() : release **toutes** les sessions actives (Wall + single).
 */
export function useWallControl() {
  const queryClient = useQueryClient()

  const removeSession = useManualControlStore((s) => s.removeSession)
  const startWallSession = useManualControlStore((s) => s.startWallSession)
  const endWallSession = useManualControlStore((s) => s.endWallSession)

  const startWall = useMutation({
    mutationFn: (udids) => apiPost('/api/devices/wall/start', { udids: udids || null }),
    onSuccess: (data) => {
      const sessionId = data?.sessionId || data?.data?.sessionId
      const requested = data?.requestedUdids || data?.data?.requestedUdids || []
      if (!sessionId) {
        toast.error('Réponse start-wall invalide (sessionId manquant)')
        return
      }
      startWallSession(sessionId)
      toast.info(`VNC Wall : ${requested.length} device(s) en cours de démarrage`)
    },
    onError: (err) => {
      toast.error(err?.message || 'Démarrage VNC Wall échoué')
    },
  })

  const releaseAll = useMutation({
    mutationFn: () => apiPost('/api/devices/wall/release-all', {}),
    onSuccess: (data) => {
      const released = data?.released || data?.data?.released || []
      const failed = data?.failed || data?.data?.failed || []
      released.forEach((udid) => removeSession(udid))
      endWallSession()
      queryClient.invalidateQueries({ queryKey: ['devices-live'] })
      queryClient.invalidateQueries({ queryKey: ['queue'] })
      if (failed.length > 0) {
        toast.warning(`${failed.length} release(s) ont échoué`)
      } else {
        toast.success(`${released.length} session(s) libérée(s)`)
      }
    },
    onError: (err) => {
      toast.error(err?.message || 'Release All échoué')
    },
  })

  return {
    startWall: startWall.mutate,
    releaseAll: releaseAll.mutate,
    isStarting: startWall.isPending,
    isReleasing: releaseAll.isPending,
  }
}
