import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { RunsTab } from './Activity'
import { apiPost } from '../hooks/useApi'

function saveWorkflowRun(runId, workflowName) {
  try {
    const runs = JSON.parse(localStorage.getItem('activeWorkflowRuns') || '[]')
    runs.unshift({ runId, workflowName, timestamp: Date.now() })
    localStorage.setItem('activeWorkflowRuns', JSON.stringify(runs))
  } catch { /* ignore */ }
}

export default function PostingRuns() {
  const navigate = useNavigate()
  const [retryState, setRetryState] = useState({ loading: false, result: null })

  async function handleRetryFailed(run, failedUsernames) {
    setRetryState({ loading: true, result: null })
    try {
      const data = await apiPost('/api/automation/trigger', { usernames: failedUsernames })
      if (data.runId) saveWorkflowRun(data.runId, 'PostReel')
      setRetryState({
        loading: false,
        result: { type: 'success', message: `Retry triggered for ${failedUsernames.length} account(s)`, runId: data.runId },
      })
    } catch (err) {
      setRetryState({
        loading: false,
        result: { type: 'error', message: err.message || 'Retry failed' },
      })
    }
  }

  const { result } = retryState

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Posting Runs</h1>
        <p className="text-xs text-[#333] mt-0.5">Reel posting execution history</p>
      </div>
      {result && (
        <div className={`flex items-center justify-between mb-4 p-3 rounded-md border text-xs font-medium ${
          result.type === 'error' ? 'bg-red-500/5 text-red-400 border-red-500/15' : 'bg-emerald-500/5 text-emerald-400 border-emerald-500/15'
        }`}>
          <div className="flex items-center gap-2">
            {result.type === 'error' ? <XCircle size={14} /> : <CheckCircle size={14} />}
            {result.message}
          </div>
          {result.runId && (
            <button
              onClick={() => navigate('/activity?tab=logs')}
              className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors font-semibold"
            >
              View logs <ExternalLink size={10} />
            </button>
          )}
        </div>
      )}
      <RunsTab workflowFilter="posting" onRetryFailed={handleRetryFailed} retryLoading={retryState.loading} />
    </div>
  )
}
