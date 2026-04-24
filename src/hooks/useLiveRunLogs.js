import { useState, useEffect, useRef } from 'react'

/**
 * Stream SSE des logs bruts d'un run en cours.
 * Gère snapshot + lignes live + complete, avec batching rAF pour les hauts volumes.
 *
 * @param {string|null} runId
 * @param {{ enabled?: boolean }} options
 * @returns {{ text: string, completed: boolean, connected: boolean }}
 */
export function useLiveRunLogs(runId, { enabled = true } = {}) {
  const [text, setText] = useState('')
  const [completed, setCompleted] = useState(false)
  const [connected, setConnected] = useState(false)

  // Références persistantes pour le batching
  const pendingLinesRef = useRef([])
  const rafRef = useRef(null)
  const cleanupDoneRef = useRef(false)

  useEffect(() => {
    if (!enabled || !runId) return

    // Flag pour démarrage de ce run
    cleanupDoneRef.current = false

    // Réinitialiser refs pour un nouveau run
    pendingLinesRef.current = []
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
    const es = new EventSource(`${baseUrl}/api/automation/runs/${encodeURIComponent(runId)}/logs/live`)

    const flushPending = () => {
      if (pendingLinesRef.current.length === 0) {
        rafRef.current = null
        return
      }
      if (!cleanupDoneRef.current) {
        const toAppend = pendingLinesRef.current.join('\n') + '\n'
        pendingLinesRef.current = []
        setText(prev => prev + toAppend)
      }
      rafRef.current = null
    }

    const scheduleFlush = () => {
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushPending)
      }
    }

    es.addEventListener('open', () => {
      if (!cleanupDoneRef.current) setConnected(true)
    })

    es.addEventListener('snapshot', (e) => {
      if (cleanupDoneRef.current) return
      try {
        const { lines } = JSON.parse(e.data)
        if (Array.isArray(lines) && lines.length > 0) {
          setText(lines.join('\n') + '\n')
        }
      } catch { /* ignore */ }
    })

    es.addEventListener('line', (e) => {
      if (cleanupDoneRef.current) return
      try {
        const { line } = JSON.parse(e.data)
        if (typeof line === 'string') {
          pendingLinesRef.current.push(line)
          scheduleFlush()
        }
      } catch { /* ignore */ }
    })

    es.addEventListener('complete', () => {
      if (cleanupDoneRef.current) return
      // Flush tout pending avant de marquer completed
      flushPending()
      if (!cleanupDoneRef.current) {
        setCompleted(true)
        setConnected(false)
      }
      es.close()
    })

    es.addEventListener('error', () => {
      if (!cleanupDoneRef.current) setConnected(false)
    })

    return () => {
      cleanupDoneRef.current = true
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      es.close()
      setConnected(false)
    }
  }, [runId, enabled])

  return { text, completed, connected }
}
