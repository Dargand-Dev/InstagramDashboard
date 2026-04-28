import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useManualControlStore } from '@/stores/manualControlStore'
import { useAuthStore } from '@/stores/authStore'

/**
 * Composant invisible : restaure les sessions manual au mount, et synchronise
 * via WebSocket les events de deux topics :
 *  - /topic/devices/status — single-session events (MANUAL_CONTROL_TAKEN/RELEASED)
 *  - /topic/wall/status    — wall session events (WALL_DEVICE_STARTING/READY/FAILED)
 *
 * Doit être monté UNE SEULE FOIS, à l'intérieur de la zone authentifiée
 * (sinon useWebSocket plante sans token). Centraliser ici les subscriptions
 * évite les double-subscribes quand plusieurs composants utilisent
 * useWallControl().
 */
export default function ManualControlBootstrapper() {
  const queryClient = useQueryClient()
  const setSession = useManualControlStore((s) => s.setSession)
  const removeSession = useManualControlStore((s) => s.removeSession)
  const setWalling = useManualControlStore((s) => s.setWalling)
  const token = useAuthStore((s) => s.token)
  const { subscribe, isConnected } = useWebSocket()

  const { data: sessions } = useQuery({
    queryKey: ['manual-control-active'],
    queryFn: () => apiGet('/api/devices/manual-control/active'),
    refetchOnWindowFocus: false,
    enabled: !!token,
    select: (res) => (Array.isArray(res) ? res : (res?.data ?? [])),
  })

  // Restore au mount
  useEffect(() => {
    if (!sessions) return
    sessions.forEach((s) => {
      setSession(s.udid, {
        udid: s.udid,
        deviceName: s.deviceName || s.udid,
        vncUrl: s.vncUrl,
        deviceIp: s.deviceIp,
        since: s.since,
      })
    })
  }, [sessions, setSession])

  // Sync WS sur le topic devices/status (events single-session)
  useEffect(() => {
    if (!isConnected) return
    const unsub = subscribe('/topic/devices/status', (raw) => {
      if (!raw || typeof raw !== 'object') return
      if (raw.eventType === 'MANUAL_CONTROL_TAKEN') {
        setSession(raw.deviceUdid, {
          udid: raw.deviceUdid,
          deviceName: raw.deviceName || raw.deviceUdid,
          vncUrl: raw.vncUrl,
          deviceIp: raw.deviceIp,
          since: raw.since,
        })
      } else if (raw.eventType === 'MANUAL_CONTROL_RELEASED') {
        removeSession(raw.deviceUdid)
      }
    })
    return unsub
  }, [isConnected, subscribe, setSession, removeSession])

  // Sync WS sur le topic wall/status (events wall multi-session)
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

  return null
}
