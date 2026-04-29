import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw, Terminal as TerminalIcon } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/shared/EmptyState'
import TerminalView from '@/components/devices/TerminalView'
import { useWebSocket } from '@/hooks/useWebSocket'

function errorMessage(err) {
  const status = err?.status
  if (status === 404) return { title: 'Device introuvable', desc: "L'UDID ne correspond à aucun device enregistré." }
  if (status === 422) return { title: 'IP non configurée', desc: 'Édite le device sur la page Devices pour renseigner son IP.' }
  if (status === 503) return { title: 'SSH injoignable', desc: 'Timeout ou authentification refusée par le device.' }
  return { title: "Impossible d'ouvrir le terminal", desc: err?.message || 'Erreur inconnue' }
}

export default function DeviceTerminal() {
  const { udid } = useParams()
  const navigate = useNavigate()
  const { isConnected } = useWebSocket()

  const [session, setSession] = useState(null)
  const [openError, setOpenError] = useState(null)
  const [opening, setOpening] = useState(false)
  const [closedReason, setClosedReason] = useState(null)
  const sessionIdRef = useRef(null)

  const { data: device } = useQuery({
    queryKey: ['device-by-udid', udid],
    queryFn: () => apiGet(`/api/devices/udid/${udid}`),
    enabled: !!udid,
  })

  const openSession = async () => {
    if (!udid || opening) return
    setOpening(true)
    setOpenError(null)
    setClosedReason(null)
    try {
      const res = await apiPost(`/api/devices/${udid}/terminal/sessions`, {})
      setSession({ sessionId: res.sessionId, deviceIp: res.deviceIp })
      sessionIdRef.current = res.sessionId
    } catch (err) {
      setOpenError(err)
    } finally {
      setOpening(false)
    }
  }

  useEffect(() => {
    openSession()
    return () => {
      const sid = sessionIdRef.current
      if (sid) {
        apiDelete(`/api/devices/terminal/sessions/${sid}`).catch(() => {})
        sessionIdRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [udid])

  const handleClosed = (reason) => {
    setClosedReason(reason)
    setSession(null)
    sessionIdRef.current = null
    if (reason === 'expired') toast.info('Session expirée (inactivité). Reconnect pour continuer.')
    else if (reason === 'eof') toast.info("Le shell distant s'est terminé.")
    else toast.error(`Session interrompue (${reason})`)
  }

  const reconnect = () => {
    setSession(null)
    sessionIdRef.current = null
    openSession()
  }

  const headerLabel = device?.name || device?.label || udid

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[#A1A1AA] hover:text-[#FAFAFA]"
            onClick={() => navigate('/devices')}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Devices
          </Button>
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-[#A1A1AA]" />
            <span className="text-sm font-medium text-[#FAFAFA]">{headerLabel}</span>
            {session?.deviceIp && (
              <span className="text-xs font-mono text-[#52525B]">{session.deviceIp}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${isConnected ? 'text-[#22C55E]' : 'text-[#F59E0B]'}`}>
            WS: {isConnected ? 'connecté' : 'déconnecté'}
          </span>
          {(closedReason || openError) && (
            <Button size="sm" variant="outline" onClick={reconnect} disabled={opening}>
              <RefreshCw className="w-3 h-3 mr-1" /> Reconnect
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {opening && !session && (
          <div className="flex h-full items-center justify-center text-sm text-[#52525B]">
            Ouverture de la session SSH…
          </div>
        )}
        {openError && !session && (() => {
          const { title, desc } = errorMessage(openError)
          return (
            <EmptyState
              icon={TerminalIcon}
              title={title}
              description={desc}
              actionLabel="Réessayer"
              onAction={reconnect}
            />
          )
        })()}
        {!openError && session && (
          <TerminalView sessionId={session.sessionId} onClosed={handleClosed} />
        )}
      </div>
    </div>
  )
}
