import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Download, Loader2 } from 'lucide-react'
import { apiPost, apiGet } from '../../../lib/api'
import { useWebSocket } from '../../../hooks/useWebSocket'

const POLL_INTERVAL_MS = 4000
const RESET_DELAY_MS = 3000

export default function FetchStatsButton({ onComplete }) {
  const [jobState, setJobState] = useState('idle')
  const [progress, setProgress] = useState(null)
  const [jobId, setJobId] = useState(null)
  const { subscribe, isConnected } = useWebSocket()

  const resetTimerRef = useRef(null)
  const pollTimerRef = useRef(null)
  const onCompleteRef = useRef(onComplete)
  const inFlightRef = useRef(false)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
  }, [])

  const handleTerminal = (event) => {
    const okCount = (event.totalAccounts || 0) - (event.failedAccounts || 0)
    if (event.status === 'COMPLETED') {
      setJobState('done')
      toast.success(`Stats fetched for ${okCount}/${event.totalAccounts} accounts`)
    } else {
      setJobState('error')
      toast.error(`Fetch failed (${event.failedAccounts}/${event.totalAccounts} accounts failed)`)
    }
    onCompleteRef.current?.()

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(() => {
      setJobState('idle')
      setProgress(null)
      setJobId(null)
    }, RESET_DELAY_MS)
  }

  useEffect(() => {
    if (!jobId) return

    let unsubscribe = null
    if (isConnected) {
      unsubscribe = subscribe(`/topic/reel-stats/progress/${jobId}`, (event) => {
        setProgress(event)
        if (event.status === 'COMPLETED' || event.status === 'FAILED') {
          handleTerminal(event)
        }
      })
    }

    // Polling fallback: covers WS disconnect, cold connection, or missed events
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    pollTimerRef.current = setInterval(async () => {
      try {
        const job = await apiGet(`/api/reel-stats/jobs/${jobId}`)
        if (!job || !job.id) return
        setProgress((prev) => ({
          jobId: job.id,
          status: job.status,
          totalAccounts: job.totalAccounts,
          processedAccounts: job.processedAccounts,
          failedAccounts: job.failedAccounts,
          currentUsername: prev?.currentUsername,
          lastError: prev?.lastError,
        }))
        if (job.status === 'COMPLETED' || job.status === 'FAILED') {
          handleTerminal({
            status: job.status,
            totalAccounts: job.totalAccounts,
            failedAccounts: job.failedAccounts,
          })
        }
      } catch (err) {
        console.warn('[ReelStats] job poll failed', err)
      }
    }, POLL_INTERVAL_MS)

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [jobId, isConnected, subscribe])

  const handleClick = async () => {
    if (inFlightRef.current || jobState === 'running') return
    inFlightRef.current = true

    try {
      setJobState('running')
      setProgress(null)
      const response = await apiPost('/api/reel-stats/fetch', {})
      if (response?.jobId) {
        setJobId(response.jobId)
        toast.info(`Fetching stats for ${response.totalAccounts} accounts...`)
      } else {
        throw new Error('No job ID returned')
      }
    } catch (err) {
      console.error('[ReelStats] Fetch failed', err)
      toast.error(err.message || 'Failed to start fetch')
      setJobState('error')
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => setJobState('idle'), RESET_DELAY_MS)
    } finally {
      inFlightRef.current = false
    }
  }

  const isRunning = jobState === 'running'
  const totalAccounts = progress?.totalAccounts ?? 0
  const processedAccounts = progress?.processedAccounts ?? 0
  const pct = totalAccounts > 0 ? Math.round((processedAccounts / totalAccounts) * 100) : 0

  return (
    <div className="flex flex-col items-end gap-2 min-w-[240px]">
      <button
        onClick={handleClick}
        disabled={isRunning}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isRunning
            ? 'bg-[#0a0a0a] border border-[#1a1a1a] text-[#888] cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 text-white'
        }`}
      >
        {isRunning ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Fetching... {processedAccounts}/{totalAccounts}
          </>
        ) : (
          <>
            <Download size={14} />
            Fetch All Stats
          </>
        )}
      </button>

      {isRunning && progress && (
        <div className="w-full flex flex-col gap-1">
          <div className="h-1 bg-[#141414] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          {progress.currentUsername && (
            <span className="text-[10px] text-[#666] truncate">
              {progress.currentUsername}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
