import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGetBlob, apiPost } from '@/lib/api'
import { useRunLogsWithLive } from '@/hooks/useRunLogsWithLive'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import LogViewer from '@/components/shared/LogViewer'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { ArrowLeft, Terminal, Copy, Check, Download, LoaderCircle, Square, SkullIcon } from 'lucide-react'
import { toast } from 'sonner'

export default function RunLogs() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { text, isLoading, isError, isActive, showingLive, liveConnected } =
    useRunLogsWithLive(runId, { enabled: true })

  const containerRef = useRef(null)
  const [viewerHeight, setViewerHeight] = useState(600)
  const [copied, setCopied] = useState(false)
  const [killDialogOpen, setKillDialogOpen] = useState(false)

  const downloadXml = useMutation({
    mutationFn: async (requestedRunId) => {
      const blob = await apiGetBlob(`/api/automation/runs/${encodeURIComponent(requestedRunId)}/page-source`)
      if (!blob.size || !/^(application|text)\/xml(?:;|$)/i.test(blob.type)) {
        throw new Error('La source XML est indisponible pour cette session')
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filenameRunId = requestedRunId.replace(/[^a-zA-Z0-9_-]/g, '_')
      link.href = url
      link.download = `page-source-${filenameRunId}-${timestamp}.xml`
      document.body.appendChild(link)
      try {
        link.click()
      } finally {
        link.remove()
        // Keep the URL alive long enough for the browser to start the download.
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    },
    onSuccess: () => toast.success('Téléchargement du XML lancé'),
    onError: (err) => toast.error(err.message || 'Échec du téléchargement du XML'),
  })

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

  const handleCopyLogs = () => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setViewerHeight(containerRef.current.clientHeight)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4 shrink-0 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-[#A1A1AA] hover:text-[#FAFAFA]"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#A1A1AA]" />
          <h1 className="text-lg font-semibold text-[#FAFAFA]">Logs</h1>
          <span className="text-xs text-[#52525B] font-mono">{runId}</span>
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
        </div>
        {isActive && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[#F59E0B] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10"
              onClick={() => stopGraceful.mutate()}
              disabled={stopGraceful.isPending}
            >
              <Square className="w-3 h-3 mr-1" />
              Stop Gracefully
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
              onClick={() => setKillDialogOpen(true)}
            >
              <SkullIcon className="w-3 h-3 mr-1" />
              Kill
            </Button>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadXml.mutate(runId)}
            disabled={!isActive || downloadXml.isPending}
            aria-busy={downloadXml.isPending}
            title={isActive
              ? 'Télécharger la source XML de l’écran actuel du téléphone'
              : 'La capture XML nécessite un run actif avec une session Appium'}
          >
            {downloadXml.isPending
              ? <LoaderCircle data-icon="inline-start" className="animate-spin" />
              : <Download data-icon="inline-start" />}
            {downloadXml.isPending ? 'Capture du XML…' : 'Télécharger le XML'}
          </Button>
          {text && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-[#A1A1AA] hover:text-[#FAFAFA] gap-1.5"
              onClick={handleCopyLogs}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copié' : 'Copier les logs'}
            </Button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full bg-[#111111]" />
            ))}
          </div>
        ) : isError || !text ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-xs text-[#52525B]">
              {showingLive ? 'En attente des premières lignes…' : 'Pas de logs disponibles pour ce run.'}
            </p>
          </div>
        ) : (
          <LogViewer text={text} follow={showingLive} height={viewerHeight} />
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
    </div>
  )
}
