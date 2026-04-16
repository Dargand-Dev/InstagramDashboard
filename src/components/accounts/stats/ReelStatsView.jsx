import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { apiGet } from '../../../lib/api'
import ReelStatsGrid from './ReelStatsGrid'
import AccountReelsDrilldown from './AccountReelsDrilldown'
import FetchStatsButton from './FetchStatsButton'
import TimeAgo from '../../shared/TimeAgo'

export default function ReelStatsView() {
  const [selectedUsername, setSelectedUsername] = useState(null)
  const queryClient = useQueryClient()

  const {
    data: summaries,
    isLoading: summariesLoading,
    error: summariesError,
  } = useQuery({
    queryKey: ['reel-stats-summaries'],
    queryFn: () => apiGet('/api/reel-stats/summaries'),
  })

  const {
    data: latestJob,
    error: latestJobError,
  } = useQuery({
    queryKey: ['reel-stats-latest-job'],
    queryFn: async () => {
      try {
        return await apiGet('/api/reel-stats/jobs/latest')
      } catch (err) {
        // 204 No Content is expected when no job has run yet
        if (err?.message?.includes('204')) return null
        throw err
      }
    },
  })

  const handleFetchComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['reel-stats-summaries'] })
    queryClient.invalidateQueries({ queryKey: ['reel-stats-latest-job'] })
  }

  if (selectedUsername) {
    return (
      <AccountReelsDrilldown
        username={selectedUsername}
        onBack={() => setSelectedUsername(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-white text-base font-semibold">Reel Performance</h2>
          <p className="text-[#666] text-xs">
            {latestJob?.completedAt ? (
              <>
                Last fetched <TimeAgo date={latestJob.completedAt} /> —{' '}
                <span className="text-[#888]">
                  {latestJob.totalAccounts - latestJob.failedAccounts}/{latestJob.totalAccounts} accounts
                </span>
              </>
            ) : latestJobError ? (
              <span className="text-amber-500">Could not read latest job status</span>
            ) : (
              'No data yet. Click Fetch to start.'
            )}
          </p>
        </div>
        <FetchStatsButton onComplete={handleFetchComplete} />
      </div>

      {summariesError && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="text-red-300 text-sm font-medium">Failed to load reel summaries</span>
            <span className="text-red-400/80 text-xs">{summariesError.message}</span>
          </div>
        </div>
      )}

      {summariesLoading && !summariesError && (
        <div className="text-center text-[#555] py-12">Loading summaries...</div>
      )}

      {!summariesLoading && !summariesError && (!summaries || summaries.length === 0) && (
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-12 text-center">
          <p className="text-[#888] text-sm mb-2">No reel stats yet</p>
          <p className="text-[#555] text-xs">Click "Fetch All Stats" to scrape reels from all ACTIVE accounts</p>
        </div>
      )}

      {!summariesLoading && !summariesError && summaries && summaries.length > 0 && (
        <ReelStatsGrid
          summaries={summaries}
          onAccountClick={setSelectedUsername}
        />
      )}
    </div>
  )
}
