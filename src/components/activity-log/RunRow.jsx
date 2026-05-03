import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDuration } from '@/utils/format'
import StatusBadge from '@/components/shared/StatusBadge'
import TimeAgo from '@/components/shared/TimeAgo'
import { deriveDisplayStatus } from '@/utils/status'
import {
  ChevronRight, ChevronDown, RotateCw, Loader2, Image, CheckCircle, XCircle, Clock, Terminal, Download, ExternalLink, PauseCircle,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import RunLogModal from './RunLogModal'

function getAccountDisplayName(detail, run, index) {
  if (detail.username && detail.username !== 'unknown') return detail.username
  if (detail.containerName || detail.container) return detail.containerName || detail.container
  return detail.account || detail.accountName || `Account ${index + 1}`
}

function getRealUsername(detail) {
  return detail.username && detail.username !== 'unknown' ? detail.username : null
}

function AccountNameLink({ username, displayName }) {
  if (!username) {
    return <span className="text-[#A1A1AA]">{displayName}</span>
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Link
        to={`/accounts?username=${encodeURIComponent(username)}`}
        onClick={e => e.stopPropagation()}
        className="text-[#A1A1AA] hover:text-[#3B82F6] hover:underline transition-colors"
      >
        {displayName}
      </Link>
      <a
        href={`https://instagram.com/${username}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className="text-[#52525B] hover:text-[#3B82F6] transition-colors"
        title="Open Instagram profile"
      >
        <ExternalLink className="w-3 h-3" />
      </a>
    </span>
  )
}

export default function RunRow({ run, onRetry, retryingId }) {
  const [expanded, setExpanded] = useState(false)
  const [screenshotOpen, setScreenshotOpen] = useState(null)
  const [showLogs, setShowLogs] = useState(false)
  const results = run.results || run.accountResults || []
  const successCount = results.filter(r => r.status === 'SUCCESS' || r.success).length
  const failCount = results.filter(r => ['FAILED', 'ERROR', 'ABORTED'].includes(r.status) || r.failed).length
  const autoSuspendCount = results.filter(r => r.skipCode === 'AUTO_SUSPENDED').length
  const runId = run.runId || run.id
  const isRetrying = retryingId === runId

  const failedAccounts = results
    .filter(r => ['FAILED', 'ERROR', 'ABORTED'].includes(r.status) || r.failed)
    .map((r, i) => getAccountDisplayName(r, run, i))
    .filter(Boolean)

  const canRetry = onRetry && failCount > 0 && failedAccounts.length > 0

  const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')

  return (
    <div className="border-b border-[#1a1a1a] last:border-0">
      <div
        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#161616] transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setExpanded(!expanded))}
      >
        <div className="shrink-0">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-[#52525B]" />
            : <ChevronRight className="w-3.5 h-3.5 text-[#52525B]" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#FAFAFA] font-medium">{run.workflowName || run.workflowType || run.trigger || 'Run'}</span>
            <StatusBadge status={run.status} />
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-[#52525B]">
            <span>{run.triggerType || run.trigger || 'manual'}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {(successCount > 0 || failCount > 0 || autoSuspendCount > 0) && (
            <div className="flex items-center gap-2 text-xs">
              {successCount > 0 && <span className="text-[#22C55E]">{successCount} ok</span>}
              {failCount > 0 && <span className="text-[#EF4444]">{failCount} fail</span>}
              {autoSuspendCount > 0 && <span className="text-[#A855F7]">{autoSuspendCount} auto-suspend</span>}
            </div>
          )}
          {(run.workflowRunId || (runId && String(runId).startsWith('wf-'))) && (
            <button
              onClick={e => { e.stopPropagation(); setShowLogs(true) }}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border bg-[#3B82F6]/8 text-[#3B82F6] border-[#3B82F6]/15 hover:bg-[#3B82F6]/15 transition-colors"
            >
              <Terminal className="w-3 h-3" /> Logs
            </button>
          )}
          {canRetry && (
            <button
              onClick={e => { e.stopPropagation(); onRetry(run, failedAccounts) }}
              disabled={isRetrying}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border bg-amber-500/8 text-amber-400 border-amber-500/15 hover:bg-amber-500/15 transition-colors disabled:opacity-40"
            >
              {isRetrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
              Retry ({failedAccounts.length})
            </button>
          )}
          <span className="text-xs text-[#52525B] tabular-nums w-16 text-right">{formatDuration(run.duration || run.durationMs)}</span>
          <TimeAgo date={run.startTime || run.startedAt || run.date || run.createdAt} className="text-xs text-[#52525B] w-16 text-right" />
        </div>
      </div>
      {expanded && results.length > 0 && (
        <div className="px-4 pb-3 pl-12">
          <div className="rounded-lg border border-[#1a1a1a] bg-[#0A0A0A] divide-y divide-[#1a1a1a]">
            {results.map((r, i) => {
              const isSuccess = r.status === 'SUCCESS' || r.success
              const isAutoSuspend = r.skipCode === 'AUTO_SUSPENDED'
              return (
              <div key={i} className="px-3 py-2 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isAutoSuspend
                      ? <PauseCircle className="w-3 h-3 text-[#A855F7] shrink-0" />
                      : isSuccess
                        ? <CheckCircle className="w-3 h-3 text-[#22C55E] shrink-0" />
                        : <XCircle className="w-3 h-3 text-[#EF4444] shrink-0" />
                    }
                    <AccountNameLink username={getRealUsername(r)} displayName={getAccountDisplayName(r, run, i)} />
                  </div>
                  <div className="flex items-center gap-3">
                    {r.durationMs > 0 && (
                      <span className="flex items-center gap-1 text-[#52525B] font-mono">
                        <Clock className="w-3 h-3 text-[#333]" />
                        {formatDuration(r.durationMs)}
                      </span>
                    )}
                    {r.errorScreenshotPath && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setScreenshotOpen(r.errorScreenshotPath) }}
                        className="text-[#3B82F6] hover:text-[#60A5FA] inline-flex items-center gap-1"
                      >
                        <Image className="w-3 h-3" /> Screenshot
                      </button>
                    )}
                    {r.errorDomPath && (
                      <a
                        href={`${baseUrl}/api/screenshots/${r.errorDomPath}`}
                        download
                        onClick={e => e.stopPropagation()}
                        className="text-[#8B5CF6] hover:text-[#A78BFA] inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> DOM
                      </a>
                    )}
                    {r.failureReason && (
                      <span className={`truncate max-w-[300px] ${isAutoSuspend ? 'text-[#A855F7]' : 'text-[#EF4444]'}`}>{r.failureReason}</span>
                    )}
                    <StatusBadge status={deriveDisplayStatus(r) || r.status || (r.success ? 'SUCCESS' : 'FAILED')} />
                  </div>
                </div>
                {r.fullErrorMessage && expanded && (
                  <pre className="text-[10px] text-[#EF4444]/70 bg-[#111111] rounded p-2 mt-1 overflow-x-auto max-h-40 whitespace-pre-wrap font-mono">
                    {r.fullErrorMessage}
                  </pre>
                )}
                {r.failedSteps && r.failedSteps.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {r.failedSteps.map((fs, j) => (
                      <div key={j} className="text-[10px] text-[#EF4444]/60">
                        <span className="text-[#A1A1AA]">[{fs.stepName}]</span> {fs.errorMessage}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )})}
          </div>
        </div>
      )}
      {expanded && results.length === 0 && (
        <div className="px-4 pb-3 pl-12">
          <p className="text-xs text-[#52525B]">No account-level details available</p>
        </div>
      )}

      {/* Screenshot dialog */}
      <Dialog open={!!screenshotOpen} onOpenChange={() => setScreenshotOpen(null)}>
        <DialogContent className="bg-[#0A0A0A] border-[#1a1a1a] sm:max-w-2xl p-2">
          {screenshotOpen && (
            <img
              src={`${baseUrl}/api/screenshots/${screenshotOpen}`}
              alt="Error screenshot"
              className="w-full rounded-lg"
              onError={(e) => { e.target.src = ''; e.target.alt = 'Screenshot not available' }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Run logs modal */}
      {showLogs && (
        <RunLogModal
          runId={run.workflowRunId || runId}
          open={showLogs}
          onClose={() => setShowLogs(false)}
        />
      )}
    </div>
  )
}
