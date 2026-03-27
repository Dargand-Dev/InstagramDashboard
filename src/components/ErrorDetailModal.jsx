import { useState, useEffect } from 'react'
import { X, Camera, ChevronDown, ChevronRight, AlertTriangle, Clock, Layers } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { formatDuration } from './LogStreamCard'
import { Blur } from '../contexts/IncognitoContext'

export default function ErrorDetailModal({ detail, onClose }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [stackOpen, setStackOpen] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!detail) return null

  const hasScreenshot = !!detail.errorScreenshotPath
  const fullMessage = detail.fullErrorMessage || detail.failureReason
  const failedSteps = detail.failedSteps || []
  // Find first stack trace from failed steps
  const stackTrace = failedSteps.find(s => s.stackTrace)?.stackTrace

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative max-w-2xl w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] sticky top-0 bg-[#0a0a0a] z-10">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-white font-bold text-sm truncate">
              <Blur>{detail.username || 'Unknown'}</Blur>
            </span>
            <StatusBadge status={detail.status || 'FAILED'} />
            {detail.completedSteps != null && detail.totalSteps != null && (
              <span className="flex items-center gap-1 text-[10px] text-[#555] font-mono">
                <Layers size={10} />
                {detail.completedSteps}/{detail.totalSteps}
              </span>
            )}
            {detail.durationMs > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-[#555] font-mono">
                <Clock size={10} />
                {formatDuration(detail.durationMs)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-white transition-colors shrink-0 ml-3"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Screenshot */}
          {hasScreenshot && (
            <div>
              <p className="text-[10px] text-[#555] font-medium uppercase tracking-wider mb-2">Screenshot</p>
              {!imgError ? (
                <div className="relative">
                  {!imgLoaded && (
                    <div className="w-full h-48 bg-[#111] border border-[#1a1a1a] rounded-md animate-pulse" />
                  )}
                  <img
                    src={`/api/screenshots/${detail.errorScreenshotPath}`}
                    alt="Error screenshot"
                    className={`w-full rounded-md border border-[#1a1a1a] cursor-pointer hover:opacity-90 transition-opacity ${imgLoaded ? '' : 'hidden'}`}
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgError(true)}
                    onClick={() => window.open(`/api/screenshots/${detail.errorScreenshotPath}`, '_blank')}
                  />
                </div>
              ) : (
                <div className="w-full py-6 bg-[#111] border border-[#1a1a1a] rounded-md flex items-center justify-center gap-2 text-xs text-[#333]">
                  <Camera size={14} />
                  Screenshot unavailable
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {fullMessage && (
            <div>
              <p className="text-[10px] text-[#555] font-medium uppercase tracking-wider mb-2">Error Message</p>
              <pre className="bg-[#050505] border border-[#1a1a1a] rounded-md p-3 text-xs text-red-400/80 font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                {fullMessage}
              </pre>
            </div>
          )}

          {/* Failed steps */}
          {failedSteps.length > 0 && (
            <div>
              <p className="text-[10px] text-[#555] font-medium uppercase tracking-wider mb-2">
                Failed Steps ({failedSteps.length})
              </p>
              <div className="space-y-1.5">
                {failedSteps.map((step, i) => (
                  <div key={i} className="bg-[#050505] border border-[#1a1a1a] rounded-md px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={10} className="text-red-400/60 shrink-0" />
                      <span className="text-[10px] font-semibold text-red-400/80 font-mono">{step.stepName}</span>
                    </div>
                    {step.errorMessage && (
                      <p className="text-xs text-[#555] pl-4 break-words">{step.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stack trace (collapsible) */}
          {stackTrace && (
            <div>
              <button
                onClick={() => setStackOpen(!stackOpen)}
                className="flex items-center gap-1.5 text-[10px] text-[#555] font-medium uppercase tracking-wider hover:text-[#777] transition-colors"
              >
                {stackOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                Stack Trace
              </button>
              {stackOpen && (
                <pre className="mt-2 bg-[#050505] border border-[#1a1a1a] rounded-md p-3 font-mono text-[10px] text-[#555] whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                  {stackTrace}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
