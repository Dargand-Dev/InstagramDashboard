import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, LayoutGrid } from 'lucide-react'
import { apiGet } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useManualControlStore } from '@/stores/manualControlStore'
import { useManualControl } from '@/hooks/useManualControl'
import { useWallControl } from '@/hooks/useWallControl'
import { useWebSocket } from '@/hooks/useWebSocket'
import WallTile from '@/components/wall/WallTile'

const COLUMN_OPTIONS = [2, 3, 4, 5, 6]
const COLUMN_GRID_CLASSES = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6',
}

export default function VncWall() {
  const navigate = useNavigate()
  const [columns, setColumns] = useState(4)
  // Garde-fou : auto-start ne doit s'exécuter qu'une fois par mount,
  // même si tilesData.length oscille à cause des refetch live-status.
  const autoStartedRef = useRef(false)

  const sessions = useManualControlStore((s) => s.sessions)
  const walling = useManualControlStore((s) => s.walling)
  const setWalling = useManualControlStore((s) => s.setWalling)
  const wallActive = useManualControlStore((s) => s.wallActive)
  const wallTopicSubscribed = useManualControlStore((s) => s.wallTopicSubscribed)
  const { startWall, releaseAll, isStarting, isReleasing } = useWallControl()
  const { takeControl } = useManualControl()
  const { isConnected } = useWebSocket()

  // Liste des devices enabled depuis le backend
  const { data: staticDevices = [] } = useQuery({
    queryKey: ['devices-config'],
    queryFn: () => apiGet('/api/devices'),
    select: (res) => {
      const raw = res.data || res || []
      return Array.isArray(raw) ? raw : []
    },
  })

  const { data: liveStatuses = [] } = useQuery({
    queryKey: ['devices-live'],
    queryFn: () => apiGet('/api/devices/live-status'),
    select: (res) => {
      const raw = res.data || res || []
      return Array.isArray(raw) ? raw : []
    },
    refetchInterval: 10000,
  })

  // Merge enabled + status
  const tilesData = useMemo(() => {
    const liveMap = {}
    liveStatuses.forEach((ls) => {
      liveMap[ls.deviceUdid || ls.udid] = ls
    })
    return staticDevices
      .filter((d) => d.enabled !== false)
      .map((d) => ({
        udid: d.udid,
        name: d.name || d.label || d.udid,
        status: (liveMap[d.udid] || {}).status || 'OFFLINE',
      }))
  }, [staticDevices, liveStatuses])

  // Au mount : démarre la wall une seule fois quand on a la liste des devices.
  // autoStartedRef évite de re-démarrer si tilesData.length oscille à cause
  // des refetch /live-status, ou si l'utilisateur fait release-all puis revient.
  // Garde-fou critique : isConnected ET wallTopicSubscribed DOIVENT être true
  // avant de POST /start. Sinon le backend publie WALL_DEVICE_STARTING/READY
  // avant que la subscription STOMP soit enregistrée → events perdus → tiles
  // coincées sur "Démarrage TrollVNC...".
  useEffect(() => {
    if (
      autoStartedRef.current ||
      !isConnected ||
      !wallTopicSubscribed ||
      wallActive ||
      isStarting ||
      tilesData.length === 0
    ) {
      return
    }
    const reachableUdids = tilesData
      .filter((d) => d.status !== 'OFFLINE' && d.status !== 'DISCONNECTED')
      .map((d) => d.udid)
    if (reachableUdids.length > 0) {
      autoStartedRef.current = true
      startWall(reachableUdids)
    }
  }, [tilesData, wallActive, isStarting, startWall, isConnected, wallTopicSubscribed])

  // Retry pour un device en FAILED : passe par le hook useManualControl pour
  // que le store soit correctement mis à jour (sessions[udid] + walling cleared).
  const handleRetry = (udid) => {
    const device = tilesData.find((d) => d.udid === udid)
    setWalling(udid, 'STARTING', { deviceName: device?.name })
    takeControl({ udid, deviceName: device?.name })
  }

  // Compute per-device state
  const stateFor = (device) => {
    if (device.status === 'OFFLINE' || device.status === 'DISCONNECTED') return 'OFFLINE'
    if (sessions[device.udid]) return 'READY'
    if (walling[device.udid]?.status === 'FAILED') return 'FAILED'
    if (walling[device.udid]?.status === 'STARTING') return 'STARTING'
    // Device is enabled and online but no walling/session yet — treat as STARTING
    // (initial render before STOMP STARTING event arrives)
    return 'STARTING'
  }

  const summary = useMemo(() => {
    const counts = { READY: 0, STARTING: 0, FAILED: 0, OFFLINE: 0 }
    tilesData.forEach((d) => {
      counts[stateFor(d)] = (counts[stateFor(d)] || 0) + 1
    })
    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tilesData, sessions, walling])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-[#A1A1AA]"
            onClick={() => navigate('/devices')}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Devices
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-[#FAFAFA] flex items-center gap-2">
              <LayoutGrid className="w-5 h-5" /> VNC Wall
            </h1>
            <p className="text-xs text-[#52525B] mt-0.5">
              {summary.READY} actif · {summary.STARTING} démarrage · {summary.FAILED} échec · {summary.OFFLINE} hors ligne
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#52525B]">Colonnes</span>
          <div className="flex items-center gap-1 bg-[#111111] border border-[#1a1a1a] rounded-md p-0.5">
            {COLUMN_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setColumns(n)}
                className={`px-2 py-1 text-xs rounded ${
                  columns === n ? 'bg-[#1a1a1a] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-[#1a1a1a] text-[#A1A1AA] hover:text-[#FAFAFA]"
            disabled={isReleasing || (Object.keys(sessions).length === 0 && !isStarting)}
            onClick={() => releaseAll()}
          >
            {isReleasing ? 'Release...' : 'Release All'}
          </Button>
        </div>
      </div>

      {/* Grid */}
      {tilesData.length === 0 ? (
        <div className="text-center text-[#52525B] py-12">
          <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun device enabled</p>
        </div>
      ) : (
        <div className={`grid gap-3 ${COLUMN_GRID_CLASSES[columns]}`}>
          {tilesData.map((device) => {
            const state = stateFor(device)
            const session = sessions[device.udid]
            const wallingEntry = walling[device.udid]
            return (
              <WallTile
                key={device.udid}
                device={device}
                state={state}
                vncUrl={session?.vncUrl}
                error={wallingEntry?.error}
                onRetry={state === 'FAILED' ? () => handleRetry(device.udid) : undefined}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
