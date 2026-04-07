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

export function useToggleDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deviceUdid, enabled }) =>
      apiPost(`${BASE}/configs/${encodeURIComponent(deviceUdid)}/${enabled ? 'enable' : 'disable'}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-creation-status'] })
      queryClient.invalidateQueries({ queryKey: ['auto-creation-configs'] })
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
