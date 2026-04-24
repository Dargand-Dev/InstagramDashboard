import { useMemo, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { useActiveRuns } from './useActiveRuns'
import { useLiveRunLogs } from './useLiveRunLogs'

/**
 * Hook composite : affiche les logs en live pendant un run actif, bascule sur
 * la vue persistée à la fin (avec retry pour couvrir le gap IMMEDIATE-kill).
 *
 * @param {string|null} runId
 * @param {{ enabled?: boolean }} options
 * @returns {{ text, isLoading, isError, isActive, showingLive, liveConnected, refresh }}
 */
export function useRunLogsWithLive(runId, { enabled = true } = {}) {
  const queryClient = useQueryClient()
  const { activeRuns } = useActiveRuns()

  const isActive = useMemo(
    () => activeRuns.some(r => (r.runId || r.id) === runId),
    [activeRuns, runId],
  )

  // Live stream : actif uniquement quand le run est actif
  const live = useLiveRunLogs(runId, { enabled: enabled && isActive })

  // Persisté : chargé quand le run n'est pas actif, ou quand live a reporté "complete"
  const persistedEnabled = !!(runId && enabled && (!isActive || live.completed))
  const persisted = useQuery({
    queryKey: ['run-logs', runId],
    queryFn: () => apiGet(`/api/automation/runs/${encodeURIComponent(runId)}/logs`),
    enabled: persistedEnabled,
    staleTime: Infinity,
    select: (data) => data?.logText || '',
    // Gap IMMEDIATE-kill : completeStream fire avant flushRunLogs, le GET renvoie 404
    // le temps que le worker thread finalise. On retry activement.
    retry: (failureCount, error) => {
      if (failureCount >= 5) return false
      const status = error?.status || error?.response?.status
      // Retry si 404 uniquement (pas de bruit sur 401/500)
      return status === 404
    },
    retryDelay: (attempt) => 500 * (attempt + 1),
  })

  // Quand live.completed passe à true, invalider le cache persisté pour refetch frais
  const didInvalidateRef = useRef(false)
  useEffect(() => {
    if (live.completed && !didInvalidateRef.current) {
      didInvalidateRef.current = true
      queryClient.invalidateQueries({ queryKey: ['run-logs', runId] })
    }
    if (!live.completed) {
      didInvalidateRef.current = false
    }
  }, [live.completed, runId, queryClient])

  // Reset l'invalidation flag quand runId change
  useEffect(() => {
    didInvalidateRef.current = false
  }, [runId])

  // Showing live : en direct tant que le run est actif ET que live n'a pas confirmé complete
  // (ou que persisted n'a pas encore des données fraîches).
  const persistedHasData = !!persisted.data
  const showingLive = isActive && !(live.completed && persistedHasData)

  const text = showingLive ? live.text : (persisted.data || '')
  const isLoading = showingLive
    ? (!live.connected && !live.text)
    : persisted.isLoading
  const isError = !showingLive && persisted.isError && !live.text

  return {
    text,
    isLoading,
    isError,
    isActive,
    showingLive,
    liveConnected: live.connected,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['run-logs', runId] }),
  }
}
