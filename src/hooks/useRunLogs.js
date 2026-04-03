import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'

export function useRunLogs(runId) {
  return useQuery({
    queryKey: ['run-logs', runId],
    queryFn: () => apiGet(`/api/automation/runs/${encodeURIComponent(runId)}/logs`),
    enabled: !!runId,
    staleTime: Infinity,
    select: (data) => data.logText || '',
  })
}
