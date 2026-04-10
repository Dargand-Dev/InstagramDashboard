import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useRunLogs } from '@/hooks/useRunLogs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import LogViewer from '@/components/shared/LogViewer'
import { ArrowLeft, Terminal, Copy, Check } from 'lucide-react'

export default function RunLogs() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { data: logText, isLoading, isError } = useRunLogs(runId)
  const containerRef = useRef(null)
  const [viewerHeight, setViewerHeight] = useState(600)
  const [copied, setCopied] = useState(false)

  const handleCopyLogs = () => {
    if (!logText) return
    navigator.clipboard.writeText(logText).then(() => {
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
      <div className="flex items-center gap-3 mb-4 shrink-0">
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
        </div>
        {logText && (
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
      <div ref={containerRef} className="flex-1 min-h-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full bg-[#111111]" />
            ))}
          </div>
        ) : isError || !logText ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-xs text-[#52525B]">Pas de logs disponibles pour ce run.</p>
          </div>
        ) : (
          <LogViewer text={logText} follow={false} height={viewerHeight} />
        )}
      </div>
    </div>
  )
}
