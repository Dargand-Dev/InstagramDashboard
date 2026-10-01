import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'

const BASE = '/api/automation/reel-verification'
const RESUME_UPLOADS_KEY = ['reel-verification', 'resume-uploads']

/**
 * Retrouve le traitement actif à l'ouverture de la page, puis suit son runId.
 * Conserve le bilan terminé dans le cache jusqu'au prochain lancement.
 */
export function useResumeUploads() {
  const qc = useQueryClient()
  return useQuery({
    queryKey: RESUME_UPLOADS_KEY,
    queryFn: async ({ signal }) => {
      const previous = qc.getQueryData(RESUME_UPLOADS_KEY)
      if (previous?.status === 'RUNNING') {
        try {
          return await apiGet(`${BASE}/resume-uploads/${encodeURIComponent(previous.runId)}`, signal)
        } catch (error) {
          if (error.status !== 404) throw error
          // Après un redémarrage du serveur, le registre peut avoir perdu ce run.
          const active = await apiGet(`${BASE}/resume-uploads/active`, signal)
          return active?.runId ? active : null
        }
      }
      const active = await apiGet(`${BASE}/resume-uploads/active`, signal)
      // Un HTTP 204 est lu comme {} par apiGet.
      return active?.runId ? active : (previous || null)
    },
    staleTime: 0,
    refetchOnMount: 'always',
    // Garder le bilan à jour même lorsque Safari laisse cet onglet en arrière-plan.
    refetchIntervalInBackground: true,
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false
      return query.state.data?.status === 'RUNNING' ? 2000 : false
    },
    retry: 2,
  })
}

export function useStartResumeUploads() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryIds) => apiPost(`${BASE}/resume-uploads`, { entryIds }),
    onSuccess: async (run) => {
      if (!run?.runId) return
      // Empêche une ancienne requête /active d'effacer le run qui vient de démarrer.
      await qc.cancelQueries({ queryKey: RESUME_UPLOADS_KEY })
      qc.setQueryData(RESUME_UPLOADS_KEY, run)
    },
  })
}

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
 * Stoppe automatiquement quand status != RUNNING, quand scanId est falsy,
 * ou quand la query a épuisé ses retries en erreur (scanId expiré/inconnu,
 * backend down — sinon on polllerait toutes les 2s indéfiniment).
 */
export function useScanStatus(scanId) {
  return useQuery({
    queryKey: ['reel-verification', 'scan', scanId],
    queryFn: () => apiGet(`${BASE}/scan/${scanId}`),
    enabled: !!scanId,
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false
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

export function useDismissOne() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryId) => apiPost(`${BASE}/dismiss`, { entryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reel-verification', 'missing'] })
    },
  })
}
