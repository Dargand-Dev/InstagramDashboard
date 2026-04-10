import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'

const BASE = '/api/auto-creation'

export function useAutoCreationStatus() {
  return useQuery({
    queryKey: ['auto-creation-status'],
    queryFn: () => apiGet(`${BASE}/status`),
    refetchInterval: 5000,
  })
}

export function useAutoCreationConfigs() {
  return useQuery({
    queryKey: ['auto-creation-configs'],
    queryFn: () => apiGet(`${BASE}/configs`),
  })
}

export function useAutoCreationConfig(deviceUdid) {
  return useQuery({
    queryKey: ['auto-creation-config', deviceUdid],
    queryFn: () => apiGet(`${BASE}/configs/${encodeURIComponent(deviceUdid)}`),
    enabled: !!deviceUdid,
  })
}

export function useUpdateConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deviceUdid, config }) =>
      apiPut(`${BASE}/configs/${encodeURIComponent(deviceUdid)}`, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-creation-status'] })
      queryClient.invalidateQueries({ queryKey: ['auto-creation-configs'] })
    },
  })
}

export function useDeleteConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deviceUdid) =>
      apiDelete(`${BASE}/configs/${encodeURIComponent(deviceUdid)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-creation-status'] })
      queryClient.invalidateQueries({ queryKey: ['auto-creation-configs'] })
    },
  })
}

export function useUpdateMode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deviceUdid, mode }) =>
      apiPut(`${BASE}/configs/${encodeURIComponent(deviceUdid)}/mode`, { mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-creation-status'] })
      queryClient.invalidateQueries({ queryKey: ['auto-creation-configs'] })
    },
  })
}

export function useUpdateContainers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deviceUdid, identityId, containers }) =>
      apiPut(
        `${BASE}/configs/${encodeURIComponent(deviceUdid)}/containers/${encodeURIComponent(identityId)}`,
        containers,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-creation-status'] })
      queryClient.invalidateQueries({ queryKey: ['auto-creation-configs'] })
    },
  })
}

/**
 * Crée en série N containers Crane via CLI sur le device cible.
 * Le backend fait crane-cli -c + ghost-cli -a + ghost-cli -s pour chaque container,
 * nomme automatiquement `<identityId>_<n>` et persiste dans la config.
 *
 * La mutation est synchrone et peut prendre plusieurs dizaines de secondes (30s × count).
 *
 * La réponse est toujours 200 OK — inspecter {error, failed, created, successCount}
 * pour décider du feedback utilisateur.
 */
export function useBatchCreateContainers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deviceUdid, identityId, count, presetId }) =>
      apiPost(
        `${BASE}/configs/${encodeURIComponent(deviceUdid)}/containers/${encodeURIComponent(identityId)}/batch-create`,
        { count, presetId },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-creation-status'] })
      queryClient.invalidateQueries({ queryKey: ['auto-creation-configs'] })
      queryClient.invalidateQueries({ queryKey: ['auto-creation-config'] })
    },
  })
}

export function useToggleGlobal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (enabled) => apiPost(`${BASE}/global/${enabled ? 'enable' : 'disable'}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-creation-status'] })
    },
  })
}

export function useCreationHistory(deviceUdid) {
  return useQuery({
    queryKey: ['auto-creation-history', deviceUdid],
    queryFn: () => apiGet(`${BASE}/history/${encodeURIComponent(deviceUdid)}`),
    enabled: !!deviceUdid,
  })
}
