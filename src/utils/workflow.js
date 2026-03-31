export function saveWorkflowRun(runId, workflowName) {
  try {
    const runs = JSON.parse(localStorage.getItem('activeWorkflowRuns') || '[]')
    runs.unshift({ runId, workflowName, timestamp: Date.now() })
    localStorage.setItem('activeWorkflowRuns', JSON.stringify(runs))
  } catch { /* ignore */ }
}
