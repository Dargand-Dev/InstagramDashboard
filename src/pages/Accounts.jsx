import { useState } from 'react'
import { Users, Trash2 } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { useApi, apiPut, apiDelete } from '../hooks/useApi'

const STATUSES = ['ALL', 'ACTIVE', 'SUSPENDED', 'BANNED', 'ERROR']

export default function Accounts() {
  const [filter, setFilter] = useState('ALL')
  const { data: accounts, loading, refetch } = useApi('/api/accounts')

  const filtered = accounts
    ? filter === 'ALL'
      ? accounts
      : accounts.filter(a => a.status === filter)
    : []

  async function handleStatusChange(id, newStatus) {
    try {
      await apiPut(`/api/accounts/${id}/status`, { status: newStatus })
      refetch()
    } catch (err) {
      alert('Failed to update status: ' + err.message)
    }
  }

  async function handleDelete(id, username) {
    if (!confirm(`Delete account ${username}?`)) return
    try {
      await apiDelete(`/api/accounts/${id}`)
      refetch()
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users size={24} />
          Accounts
        </h2>
        <div className="flex gap-2">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-primary text-white'
                  : 'bg-surface-card text-text-muted hover:text-text'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-text-muted font-medium">Username</th>
              <th className="px-4 py-3 text-text-muted font-medium">Status</th>
              <th className="px-4 py-3 text-text-muted font-medium">Device</th>
              <th className="px-4 py-3 text-text-muted font-medium">Created</th>
              <th className="px-4 py-3 text-text-muted font-medium">Followers</th>
              <th className="px-4 py-3 text-text-muted font-medium">Posts</th>
              <th className="px-4 py-3 text-text-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">No accounts found</td></tr>
            ) : (
              filtered.map(account => (
                <tr key={account.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{account.username}</td>
                  <td className="px-4 py-3"><StatusBadge status={account.status} /></td>
                  <td className="px-4 py-3 text-text-muted font-mono text-xs">{account.deviceUdid || '—'}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">{account.followersCount ?? '—'}</td>
                  <td className="px-4 py-3">{account.postsCount ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={account.status}
                        onChange={e => handleStatusChange(account.id, e.target.value)}
                        className="bg-surface-alt border border-border rounded px-2 py-1 text-xs text-text"
                      >
                        {STATUSES.filter(s => s !== 'ALL').map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleDelete(account.id, account.username)}
                        className="p-1.5 rounded hover:bg-error-dim text-text-muted hover:text-error transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
