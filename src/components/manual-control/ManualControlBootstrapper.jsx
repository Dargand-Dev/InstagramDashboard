import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useManualControlStore } from '@/stores/manualControlStore'
import { useAuthStore } from '@/stores/authStore'

/**
 * Composant invisible : restaure les sessions manual au mount, et synchronise
 * via WebSocket les events MANUAL_CONTROL_TAKEN / MANUAL_CONTROL_RELEASED.
 *
 * Doit être monté UNE SEULE FOIS, à l'intérieur de la zone authentifiée
 * (sinon useWebSocket plante sans token).
 */
export default function ManualControlBootstrapper() {
  const setSession = useManualControlStore((s) => s.setSession)
  const removeSession = useManualControlStore((s) => s.removeSession)
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

  return null
}
