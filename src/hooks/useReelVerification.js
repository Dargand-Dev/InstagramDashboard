import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'

const BASE = '/api/automation/reel-verification'

export function useStartScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (hours) => apiPost(`${BASE}/scan?hours=${hours}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reel-verification', 'missing'] })
    },
  })
}

/**
 * Poll le statut d'un scan toutes les 2s tant qu'il est RUNNING.
 * Stoppe automatiquement quand status != RUNNING ou quand scanId est falsy.
 */
export function useScanStatus(scanId) {
  return useQuery({
    queryKey: ['reel-verification', 'scan', scanId],
    queryFn: () => apiGet(`${BASE}/scan/${scanId}`),
    enabled: !!scanId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data || data.status === 'RUNNING') return 2000
      return false
    },
    retry: 3,
  })
}

export function useMissingReels(hours) {
  return useQuery({
    queryKey: ['reel-verification', 'missing', hours],
    queryFn: () => apiGet(`${BASE}/missing?hours=${hours}`),
    staleTime: 10 * 1000,
  })
}

export function useRecheckOne() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryId) => apiPost(`${BASE}/recheck`, { entryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reel-verification', 'missing'] })
    },
  })
}
