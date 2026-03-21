import { useState, Fragment } from 'react'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { useApi, apiPut, apiDelete } from '../hooks/useApi'

const STATUSES = ['ALL', 'ACTIVE', 'SUSPENDED', 'BANNED', 'ERROR']

function DetailRow({ label, value, mono = false }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between py-1.5 border-b border-[#141414] last:border-0">
      <span className="text-[#555] text-xs">{label}</span>
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Accounts</h1>
          <p className="text-xs text-[#333] mt-0.5">
            {accounts ? `${accounts.length} total` : 'Loading...'}
          </p>
        </div>
        <div className="flex gap-1.5">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold tracking-wide transition-colors border ${
                filter === s
                  ? 'bg-white/10 text-white border-[#333]'
                  : 'bg-transparent text-[#555] border-[#1a1a1a] hover:text-white hover:border-[#333]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="px-3 py-3 w-8" />
              <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Username</th>
              <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Status</th>
              <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Container</th>
              <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Device</th>
              <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Created</th>
              <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Following</th>
              <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Followers</th>
              <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Posts</th>
              <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-[#333]">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-[#333]">No accounts found</td></tr>
            ) : (
              filtered.map(account => (
                <Fragment key={account.id}>
                  <tr
                    className="border-b border-[#141414] hover:bg-[#111] transition-colors cursor-pointer"
                    onClick={() => setExpandedId(prev => prev === account.id ? null : account.id)}
                  >
                    <td className="px-3 py-2.5 text-[#333]">
                      {expandedId === account.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-white">{account.username}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={account.status} /></td>
                    <td className="px-3 py-2.5 text-[#555] font-mono">{account.craneContainer || '—'}</td>
                    <td className="px-3 py-2.5 text-[#555] font-mono">
                      {account.deviceUdid ? account.deviceUdid.slice(-8) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[#555]">
                      {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[#555]">{account.followCount ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[#555]">{account.followerCount ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[#555]">{account.postCount ?? '—'}</td>
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <select
                          value={account.status}
                          onChange={e => handleStatusChange(account.id, e.target.value)}
                          className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#333]"
                        >
                          {STATUSES.filter(s => s !== 'ALL').map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDelete(account.id, account.username)}
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-[#333] hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === account.id && (
                    <tr key={`${account.id}-detail`} className="border-b border-[#141414] bg-[#050505]">
                      <td colSpan={10} className="px-6 py-4">
                        <div className="grid grid-cols-3 gap-6 max-w-3xl">
                          <div>
                            <h4 className="label-upper mb-2">Identity</h4>
                            <DetailRow label="Phone" value={account.phone} mono />
                            <DetailRow label="Email" value={account.email} />
                            <DetailRow label="2FA Secret" value={account.totpSecret ? '••••••' + account.totpSecret.slice(-4) : null} mono />
                          </div>
                          <div>
                            <h4 className="label-upper mb-2">Infrastructure</h4>
                            <DetailRow label="Container" value={account.craneContainer} mono />
                            <DetailRow label="Device UDID" value={account.deviceUdid} mono />
                            <DetailRow label="Proxy Session" value={account.proxySession} mono />
                          </div>
                          <div>
                            <h4 className="label-upper mb-2">Activity</h4>
                            <DetailRow label="Last Login" value={account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : null} />
                            <DetailRow label="Following" value={account.followCount} />
                            <DetailRow label="Followers" value={account.followerCount} />
                            <DetailRow label="Posts" value={account.postCount} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
