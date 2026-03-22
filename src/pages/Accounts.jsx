import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Trash2, Search, Users } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { useApi, apiPut, apiDelete } from '../hooks/useApi'

const STATUSES = ['ALL', 'ACTIVE', 'SUSPENDED', 'BANNED', 'ERROR']

function statusDotColor(status) {
  switch (status) {
    case 'ACTIVE': return 'bg-emerald-500'
    case 'BANNED': return 'bg-red-500'
    case 'SUSPENDED': return 'bg-amber-500'
    case 'ERROR': return 'bg-red-500'
    default: return 'bg-gray-500'
  }
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-[#141414] last:border-0">
      <span className="text-[#555] text-sm">{label}</span>
      {value || value === 0 ? (
        <span className={`text-sm text-white ${mono ? 'font-mono' : ''}`}>{value}</span>
      ) : (
        <span className="text-sm text-[#333] italic">---</span>
      )}
    </div>
  )
}

export default function Accounts() {
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const { data: accounts, loading, refetch } = useApi('/api/accounts')

  // Auto-select account from URL query param
  useEffect(() => {
    const usernameParam = searchParams.get('username')
    if (usernameParam && accounts?.length) {
      const match = accounts.find(a => a.username === usernameParam)
      if (match) {
        setSelectedId(match.id)
      }
    }
  }, [searchParams, accounts])
  const { data: historyData } = useApi('/api/automation/posting-history?limit=5000')

  // Build post count per username from posting history
  const postCounts = {}
  if (historyData?.entries) {
    for (const entry of historyData.entries) {
      if (entry.username) {
        postCounts[entry.username] = (postCounts[entry.username] || 0) + 1
      }
    }
  }

  const statusCounts = accounts
    ? STATUSES.reduce((acc, s) => {
        acc[s] = s === 'ALL' ? accounts.length : accounts.filter(a => a.status === s).length
        return acc
      }, {})
    : {}

  const filtered = accounts
    ? (filter === 'ALL' ? accounts : accounts.filter(a => a.status === filter))
        .filter(a => a.username?.toLowerCase().includes(search.toLowerCase()))
    : []

  const selectedAccount = filtered.find(a => a.id === selectedId)

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
      setSelectedId(null)
      refetch()
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  function handleFilterChange(s) {
    setFilter(s)
    setSelectedId(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Accounts</h1>
        <p className="text-xs text-[#333] mt-0.5">
          {accounts ? `${accounts.length} total accounts` : 'Loading...'}
        </p>
      </div>

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-3" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Left Panel — Account List */}
        <div className="w-full lg:w-[380px] flex flex-col bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] overflow-hidden max-h-[400px] lg:max-h-none">
          {/* Search */}
          <div className="p-3 border-b border-[#1a1a1a]">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333]" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-[#333] focus:outline-none focus:border-[#333]"
              />
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex gap-1.5 px-3 py-2.5 border-b border-[#1a1a1a] flex-wrap">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => handleFilterChange(s)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide transition-colors border ${
                  filter === s
                    ? 'bg-white/10 text-white border-[#333]'
                    : 'bg-transparent text-[#555] border-[#1a1a1a] hover:text-white hover:border-[#333]'
                }`}
              >
                {s} {statusCounts[s] !== undefined ? statusCounts[s] : ''}
              </button>
            ))}
          </div>

          {/* Account rows */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-[#333] text-center py-8">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-[#333] text-center py-8">No accounts found</p>
            ) : (
              filtered.map(account => (
                <button
                  key={account.id}
                  onClick={() => setSelectedId(account.id)}
                  className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
                    selectedId === account.id
                      ? 'bg-blue-500/5 border-l-blue-500'
                      : 'hover:bg-[#111] border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColor(account.status)}`} />
                    <span className="text-sm font-semibold text-white truncate">{account.username}</span>
                  </div>
                  <p className="text-xs text-[#444] mt-0.5 ml-[18px] truncate">
                    {postCounts[account.username] || account.postCount || 0} posts · {account.followerCount ?? 0} followers
                  </p>
                </button>
              ))
            )}
          </div>

          {/* Footer count */}
          {!loading && (
            <div className="px-3 py-2 border-t border-[#1a1a1a]">
              <p className="text-[10px] text-[#333]">{filtered.length} account{filtered.length !== 1 ? 's' : ''}</p>
            </div>
          )}
        </div>

        {/* Right Panel — Detail */}
        <div className="flex-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] overflow-hidden">
          {selectedAccount ? (
            <div className="h-full overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                    {selectedAccount.username?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedAccount.username}</h2>
                    <div className="mt-1"><StatusBadge status={selectedAccount.status} /></div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedAccount.status}
                    onChange={e => handleStatusChange(selectedAccount.id, e.target.value)}
                    className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#333]"
                  >
                    {STATUSES.filter(s => s !== 'ALL').map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleDelete(selectedAccount.id, selectedAccount.username)}
                    className="p-2 rounded-md hover:bg-red-500/10 text-[#333] hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Stats bar */}
              <div className="grid grid-cols-3 border-b border-[#1a1a1a]">
                {[
                  { label: 'Posts', value: postCounts[selectedAccount.username] || selectedAccount.postCount },
                  { label: 'Followers', value: selectedAccount.followerCount },
                  { label: 'Following', value: selectedAccount.followCount },
                ].map(stat => (
                  <div key={stat.label} className="px-6 py-5 text-center">
                    <p className="text-3xl font-bold text-white">{stat.value ?? 0}</p>
                    <p className="text-xs text-[#555] uppercase tracking-wide mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Key-value details */}
              <div className="px-8 py-6">
                <h3 className="label-upper mb-4">Account Details</h3>

                {/* Password — custom inline */}
                <div className="flex justify-between items-center py-3 border-b border-[#141414]">
                  <span className="text-[#555] text-sm">Password</span>
                  {selectedAccount.password ? (
                    <span className="text-sm text-white font-mono">{selectedAccount.password}</span>
                  ) : (
                    <span className="text-sm text-[#333] italic">no password</span>
                  )}
                </div>

                <DetailRow label="Email" value={selectedAccount.email} />
                <DetailRow label="Phone" value={selectedAccount.phone} mono />
                <DetailRow
                  label="2FA Secret"
                  value={selectedAccount.totpSecret ? '••••••' + selectedAccount.totpSecret.slice(-4) : null}
                  mono
                />
                <DetailRow label="Container" value={selectedAccount.craneContainer} mono />
                <DetailRow label="Device UDID" value={selectedAccount.deviceUdid} mono />
                <DetailRow label="Proxy Session" value={selectedAccount.proxySession} mono />
                <DetailRow
                  label="Created"
                  value={selectedAccount.createdAt ? new Date(selectedAccount.createdAt).toLocaleDateString() : null}
                />
                <DetailRow
                  label="Last Login"
                  value={selectedAccount.lastLoginAt ? new Date(selectedAccount.lastLoginAt).toLocaleString() : null}
                />
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center">
              <Users size={48} className="text-[#1a1a1a] mb-4" />
              <p className="text-base text-[#333]">No account selected</p>
              <p className="text-xs text-[#222] mt-1">Click an account from the list to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
