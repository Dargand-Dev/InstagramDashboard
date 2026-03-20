import { useState } from 'react'
import { Users, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { useApi, apiPut, apiDelete } from '../hooks/useApi'

const STATUSES = ['ALL', 'ACTIVE', 'SUSPENDED', 'BANNED', 'ERROR']

function DetailRow({ label, value, mono = false }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-text-muted text-xs">{label}</span>
      <span className={`text-xs text-white ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

export default function Accounts() {
  const [filter, setFilter] = useState('ALL')
  const [expandedId, setExpandedId] = useState(null)
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

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id)
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
              <th className="px-4 py-3 text-text-muted font-medium w-8"></th>
              <th className="px-4 py-3 text-text-muted font-medium">Username</th>
              <th className="px-4 py-3 text-text-muted font-medium">Status</th>
              <th className="px-4 py-3 text-text-muted font-medium">Container</th>
              <th className="px-4 py-3 text-text-muted font-medium">Device</th>
              <th className="px-4 py-3 text-text-muted font-medium">Created</th>
              <th className="px-4 py-3 text-text-muted font-medium">Following</th>
              <th className="px-4 py-3 text-text-muted font-medium">Followers</th>
              <th className="px-4 py-3 text-text-muted font-medium">Posts</th>
              <th className="px-4 py-3 text-text-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-text-muted">No accounts found</td></tr>
            ) : (
              filtered.map(account => (
                <>
                  <tr key={account.id} className="border-b border-border hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => toggleExpand(account.id)}>
                    <td className="px-4 py-3 text-text-muted">
                      {expandedId === account.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{account.username}</td>
                    <td className="px-4 py-3"><StatusBadge status={account.status} /></td>
                    <td className="px-4 py-3 text-text-muted font-mono text-xs">{account.craneContainer || '—'}</td>
                    <td className="px-4 py-3 text-text-muted font-mono text-xs">
                      {account.deviceUdid ? account.deviceUdid.slice(-8) : '—'}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">{account.followCount ?? '—'}</td>
                    <td className="px-4 py-3">{account.followerCount ?? '—'}</td>
                    <td className="px-4 py-3">{account.postCount ?? '—'}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
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
                  {expandedId === account.id && (
                    <tr key={`${account.id}-detail`} className="border-b border-border bg-white/[0.02]">
                      <td colSpan={10} className="px-6 py-4">
                        <div className="grid grid-cols-3 gap-6 max-w-3xl">
                          <div>
                            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Identity</h4>
                            <DetailRow label="Phone" value={account.phone} mono />
                            <DetailRow label="Email" value={account.email} />
                            <DetailRow label="2FA Secret" value={account.totpSecret ? '••••••' + account.totpSecret.slice(-4) : null} mono />
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Infrastructure</h4>
                            <DetailRow label="Container" value={account.craneContainer} mono />
                            <DetailRow label="Device UDID" value={account.deviceUdid} mono />
                            <DetailRow label="Proxy Session" value={account.proxySession} mono />
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Activity</h4>
                            <DetailRow label="Last Login" value={account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : null} />
                            <DetailRow label="Following" value={account.followCount} />
                            <DetailRow label="Followers" value={account.followerCount} />
                            <DetailRow label="Posts" value={account.postCount} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
