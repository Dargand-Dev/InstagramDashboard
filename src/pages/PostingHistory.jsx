import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { Blur } from '../contexts/IncognitoContext'

function timeAgo(date) {
  if (!date) return '—'
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  if (diff < 0) return 'just now'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export default function PostingHistory() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const queryParams = username
    ? `/api/automation/posting-history?limit=50&username=${encodeURIComponent(username)}`
    : '/api/automation/posting-history?limit=50'
  const { data, loading } = useApi(queryParams)
  const entries = data?.entries || []

  return (
    <div>
      <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
        <BookOpen size={24} />
        Posting History
      </h2>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Filter by username..."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="bg-surface-card border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-primary w-64"
        />
      </div>

      <div className="bg-surface-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-text-muted font-medium">Date</th>
              <th className="px-4 py-3 text-text-muted font-medium">Account</th>
              <th className="px-4 py-3 text-text-muted font-medium">Base Video</th>
              <th className="px-4 py-3 text-text-muted font-medium">Template</th>
              <th className="px-4 py-3 text-text-muted font-medium">Drive Filename</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
            ) : !entries.length ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">No posting history found</td></tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3 text-text-muted">
                    {timeAgo(entry.postedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/accounts?username=${encodeURIComponent(entry.username)}`)}
                      className="text-blue-400 hover:text-blue-300 hover:underline transition-colors font-medium"
                    >
                      <Blur>{entry.username}</Blur>
                    </button>
                  </td>
                  <td className="px-4 py-3">{entry.baseVideo || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-surface-alt text-text-muted">
                      {entry.template || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{entry.driveFilename || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data?.total > 0 && (
        <p className="text-xs text-text-muted mt-3">
          Showing {data.showing} of {data.total} entries
        </p>
      )}
    </div>
  )
}
