export const TIMELINE_STATUSES = {
  COMPLETED: { label: 'Done', color: 'var(--color-success, #22C55E)' },
  SUCCESS: { label: 'Done', color: 'var(--color-success, #22C55E)' },
  PARTIAL_SUCCESS: { label: 'Done with warnings', color: 'var(--color-warning, #F59E0B)' },
  FAILED: { label: 'Failed', color: 'var(--color-error, #EF4444)' },
  ERROR: { label: 'Error', color: 'var(--color-error, #EF4444)' },
  ABORTED: { label: 'Aborted', color: 'var(--color-error, #EF4444)' },
  RUNNING: { label: 'Running', color: 'var(--primary, #3B82F6)' },
  IN_PROGRESS: { label: 'Running', color: 'var(--primary, #3B82F6)' },
  STOPPING: { label: 'Stopping', color: 'var(--color-warning, #F59E0B)' },
  PARTIAL: { label: 'Partial', color: 'var(--color-warning, #F59E0B)' },
  PARTIAL_FAILURE: { label: 'Partial failure', color: 'var(--color-warning, #F59E0B)' },
  WAITING_RETRY: { label: 'Waiting for retry', color: 'var(--color-warning, #F59E0B)' },
  DISCONNECTED: { label: 'Disconnected', color: 'var(--color-warning, #F59E0B)' },
  PAUSED: { label: 'Paused', color: 'var(--color-warning, #F59E0B)' },
  WAITING_PROXY: { label: 'Waiting for proxy', color: '#06B6D4' },
  QUEUED: { label: 'Queued', color: 'var(--color-purple, #8B5CF6)' },
  AUTO_SUSPENDED: { label: 'Auto-suspended', color: 'var(--color-purple, #8B5CF6)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--color-text-muted, #52525B)' },
  SKIPPED: { label: 'Skipped', color: 'var(--color-text-muted, #52525B)' },
  PENDING: { label: 'Pending', color: 'var(--color-text-muted, #52525B)' },
  UNKNOWN: { label: 'Unknown', color: 'var(--color-text-muted, #52525B)' },
}

const ACTIVE_STATUSES = new Set(['RUNNING', 'IN_PROGRESS', 'STOPPING', 'WAITING_PROXY'])

function normalizedStatus(status) {
  return typeof status === 'string' ? status.trim().toUpperCase().replace(/[\s-]+/g, '_') : ''
}

function timestamp(value) {
  if (value == null || value === '' || !['string', 'number'].includes(typeof value)) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function runStatus(run, hasEnd) {
  const explicit = normalizedStatus(run.status)
  if (explicit) return explicit
  const results = Array.isArray(run.accountResults)
    ? run.accountResults.map(result => normalizedStatus(result?.status)) : []
  const total = run.totalAccounts ?? ((run.successCount || 0) + (run.failureCount || 0))
  // The history API includes skipped accounts in failureCount. Only override
  // that aggregate when all account outcomes are available.
  if (hasEnd && results.length > 0 && results.length >= total) {
    if (results.every(status => status === 'SKIPPED')) return 'SKIPPED'
    if (results.every(status => ['SUCCESS', 'COMPLETED', 'PARTIAL_SUCCESS', 'SKIPPED'].includes(status))) {
      return 'COMPLETED'
    }
  }
  if (run.failureCount > 0) return 'FAILED'
  if (hasEnd || run.successCount > 0) return 'COMPLETED'
  return 'RUNNING'
}

function accountSegments(run, start, end) {
  if (!Array.isArray(run.accountEntries)) return []
  return run.accountEntries.flatMap((entry, index) => {
    if (!entry) return []
    const status = normalizedStatus(entry.status) || 'UNKNOWN'
    if (status === 'PENDING') return []
    const rawStart = timestamp(entry.startedAt)
    // A retry can retain the previous attempt's completedAt while already RUNNING.
    const rawEnd = ACTIVE_STATUSES.has(status) ? end : timestamp(entry.completedAt)
    if (rawStart == null || rawEnd == null || rawEnd <= rawStart) return []
    const segmentStart = Math.max(start, rawStart)
    const segmentEnd = Math.min(end, rawEnd)
    if (segmentEnd <= segmentStart) return []
    return [{
      key: `${entry.containerName || 'account'}-${entry.order ?? index}`,
      name: entry.containerName || entry.username || entry.name || `Account ${index + 1}`,
      status,
      start: segmentStart,
      end: segmentEnd,
      duration: segmentEnd - segmentStart,
    }]
  })
}

export function buildTimelineRows(runs, now = Date.now()) {
  if (!Array.isArray(runs) || !Number.isFinite(now)) return []
  const rows = new Map()
  const completedIds = new Set()

  runs.forEach((run, index) => {
    if (!run || typeof run !== 'object') return
    const start = timestamp(run.startedAt ?? run.startTime)
    const endValue = run.completedAt ?? run.endTime
    const rawEnd = timestamp(endValue)
    if (start == null || start >= now || (endValue != null && rawEnd == null)) return
    if (rawEnd != null && rawEnd <= start) return
    const end = Math.min(rawEnd ?? now, now)
    const status = runStatus(run, rawEnd != null)
    const runId = run.workflowRunId || run.runId || run.id || `timeline-run-${index}`
    const completed = rawEnd != null && !ACTIVE_STATUSES.has(status)
    if (rows.has(runId) && (completedIds.has(runId) || !completed)) return

    const name = run.workflowName || run.workflow || run.workflowType || 'Run'
    const segments = accountSegments(run, start, end)
    rows.set(runId, {
      runId,
      name,
      device: run.deviceName || run.device || run.deviceUdid || 'Unknown device',
      start,
      end,
      duration: end - start,
      status,
      segments: segments.length > 0 ? segments : [{
        key: `${runId}-run`, name, status, start, end, duration: end - start,
      }],
    })
    if (completed) completedIds.add(runId)
  })

  return [...rows.values()]
}
