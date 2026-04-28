import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useManualControlStore } from '@/stores/manualControlStore'

/**
 * Hook orchestrant la VNC Wall :
 * - subscribe au topic /topic/wall/status pour streamer les events
 *   STARTING/READY/FAILED dans le store.
 * - mutation startWall(udids?) : déclenche le démarrage en bulk côté backend.
 * - mutation releaseAll() : release **toutes** les sessions actives (Wall + single).
 *
 * Doit être appelé dans un composant monté à l'intérieur de la zone
 * authentifiée (le WebSocket dépend du token).
 */
export function useWallControl() {
  const queryClient = useQueryClient()
  const { subscribe, isConnected } = useWebSocket()

  const setWalling = useManualControlStore((s) => s.setWalling)
  const setSession = useManualControlStore((s) => s.setSession)
  const removeSession = useManualControlStore((s) => s.removeSession)
  const startWallSession = useManualControlStore((s) => s.startWallSession)
  const endWallSession = useManualControlStore((s) => s.endWallSession)

  // Subscribe au topic — un seul listener pour toute l'app
  useEffect(() => {
    if (!isConnected) return
    const unsub = subscribe('/topic/wall/status', (event) => {
      if (!event || typeof event !== 'object' || !event.eventType) return

      // Filtre par sessionId : on ignore les events d'une wall précédente
      const currentSessionId = useManualControlStore.getState().wallSessionId
      if (currentSessionId && event.sessionId && event.sessionId !== currentSessionId) {
        return
      }

      switch (event.eventType) {
        case 'WALL_DEVICE_STARTING':
          setWalling(event.udid, 'STARTING', { deviceName: event.deviceName, deviceIp: event.deviceIp })
          break
        case 'WALL_DEVICE_READY':
          setWalling(event.udid, 'READY')
          setSession(event.udid, {
            udid: event.udid,
            deviceName: event.deviceName || event.udid,
            vncUrl: event.vncUrl,
            deviceIp: event.deviceIp,
            since: event.since,
          })
          queryClient.invalidateQueries({ queryKey: ['devices-live'] })
          break
        case 'WALL_DEVICE_FAILED':
          setWalling(event.udid, 'FAILED', {
            deviceName: event.deviceName,
            error: event.error || 'Erreur inconnue',
          })
          break
        default:
          break
      }
    })
    return unsub
  }, [isConnected, subscribe, setWalling, setSession, queryClient])

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
