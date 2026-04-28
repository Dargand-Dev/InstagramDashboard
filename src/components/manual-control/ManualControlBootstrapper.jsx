import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useManualControlStore } from '@/stores/manualControlStore'

/**
 * Composant invisible : restaure l'état manual control au mount, et
 * synchronise via WebSocket les events MANUAL_CONTROL_TAKEN/RELEASED.
 *
 * Doit être monté UNE SEULE FOIS, à l'intérieur de la zone authentifiée
 * (sinon useWebSocket plante sans token).
 */
export default function ManualControlBootstrapper() {
  const setActive = useManualControlStore((s) => s.setActive)
  const clear = useManualControlStore((s) => s.clear)
  const { subscribe, isConnected } = useWebSocket()

  // Restore au mount — `select` doit rester pur (appelé à chaque re-render),
  // donc on déporte la mise à jour du store dans un useEffect.
  const { data: sessions } = useQuery({
    queryKey: ['manual-control-active'],
    queryFn: () => apiGet('/api/devices/manual-control/active'),
    refetchOnWindowFocus: false,
    select: (res) => (Array.isArray(res) ? res : (res?.data ?? [])),
  })

  useEffect(() => {
    if (!sessions) return
    // Pour l'instant on suppose 0 ou 1 session active à la fois
    if (sessions.length > 0) {
      const s = sessions[0]
      setActive({
        udid: s.udid,
        deviceName: s.deviceName || s.udid,
        vncUrl: s.vncUrl,
        deviceIp: s.deviceIp,
        since: s.since,
      })
    } else {
      clear()
    }
  }, [sessions, setActive, clear])

  // Sync WS
  useEffect(() => {
    if (!isConnected) return
    const unsub = subscribe('/topic/devices/status', (raw) => {
      // Le payload peut être : (a) le DeviceStatus DTO direct (markRunning, etc.),
      // ou (b) notre Map { eventType, deviceUdid, ... } envoyé par ManualControlService.
      if (!raw || typeof raw !== 'object') return
      if (raw.eventType === 'MANUAL_CONTROL_TAKEN') {
        setActive({
          udid: raw.deviceUdid,
          deviceName: raw.deviceName || raw.deviceUdid,
          vncUrl: raw.vncUrl,
          deviceIp: raw.deviceIp,
          since: raw.since,
        })
      } else if (raw.eventType === 'MANUAL_CONTROL_RELEASED') {
        const current = useManualControlStore.getState().active
        if (current && current.udid === raw.deviceUdid) {
          clear()
        }
      }
    })
    return unsub
  }, [isConnected, subscribe, setActive, clear])

  return null
}
