import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  CheckCircle, XCircle, Loader2, SkipForward, Image, ChevronDown, ChevronRight,
} from 'lucide-react'

const STATUS_ICON = {
  SUCCESS: <CheckCircle className="w-3.5 h-3.5 text-[#22C55E]" />,
  FAILED: <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />,
  RUNNING: <Loader2 className="w-3.5 h-3.5 text-[#3B82F6] animate-spin" />,
  SKIPPED: <SkipForward className="w-3.5 h-3.5 text-[#52525B]" />,
  COMPLETE: <CheckCircle className="w-3.5 h-3.5 text-[#22C55E]" />,
  BATCH_PROGRESS: <Loader2 className="w-3.5 h-3.5 text-[#3B82F6] animate-spin" />,
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDuration(ms) {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function LogEventRow({ event }) {
  const [expanded, setExpanded] = useState(false)
  const [screenshotOpen, setScreenshotOpen] = useState(false)
  const hasError = event.errorMessage || event.status === 'FAILED'
  const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')

  return (
    <>
      <div
        className={`flex items-start gap-2 px-3 py-1.5 text-xs font-mono hover:bg-[#111111] transition-colors ${hasError ? 'cursor-pointer' : ''}`}
        onClick={() => hasError && setExpanded(!expanded)}
      >
        {hasError && (
          <div className="shrink-0 mt-0.5">
            {expanded ? <ChevronDown className="w-3 h-3 text-[#52525B]" /> : <ChevronRight className="w-3 h-3 text-[#52525B]" />}
          </div>
        )}
        <span className="text-[#52525B] shrink-0 w-16">{formatTime(event.timestamp)}</span>
        {event.totalSteps > 0 && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-[#1a1a1a] text-[#52525B] shrink-0">
            {event.stepIndex}/{event.totalSteps}
          </Badge>
        )}
        <span className="text-[#A1A1AA] truncate flex-1">{event.stepName || event.message}</span>
        {event.containerName && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-[#1a1a1a] text-[#52525B] shrink-0">
            {event.containerName}
          </Badge>
        )}
        <span className="shrink-0">{STATUS_ICON[event.status] || null}</span>
        {event.durationMs > 0 && (
          <span className="text-[#52525B] shrink-0 w-12 text-right">{formatDuration(event.durationMs)}</span>
        )}
      </div>
      {expanded && hasError && (
        <div className="ml-8 mr-3 mb-2 p-2 rounded bg-[#111111] border border-[#EF4444]/10">
          <pre className="text-[10px] text-[#EF4444]/70 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
            {event.errorMessage || event.message}
          </pre>
          {event.screenshotPath && (
            <button
              onClick={() => setScreenshotOpen(true)}
              className="mt-1 text-[10px] text-[#3B82F6] hover:text-[#60A5FA] inline-flex items-center gap-1"
            >
              <Image className="w-3 h-3" /> View Screenshot
            </button>
          )}
        </div>
      )}
      {screenshotOpen && (
        <Dialog open={screenshotOpen} onOpenChange={() => setScreenshotOpen(false)}>
          <DialogContent className="bg-[#0A0A0A] border-[#1a1a1a] sm:max-w-2xl p-2">
            <img
              src={`${baseUrl}/api/screenshots/${event.screenshotPath}`}
              alt="Error screenshot"
              className="w-full rounded-lg"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
