import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Trash2, Search, Users, Link, Pencil, X, ExternalLink, Smartphone, Check, Calendar, LayoutList, LayoutGrid, ChevronRight, ChevronDown, Container, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'
import StatusBadge from '../components/StatusBadge'
import { useApi, apiPost, apiPut, apiDelete } from '../hooks/useApi'
import { useQuery } from '@tanstack/react-query'
import { scraperGet } from '@/api/scraperClient'
import AccountDailyViewsChart from '../components/AccountDailyViewsChart'
import { Blur } from '../contexts/IncognitoContext'
import AccountsTableView from '../components/accounts/AccountsTableView'
import ReelStatsView from '../components/accounts/stats/ReelStatsView'

const STATUSES = ['ALL', 'ACTIVE', 'SUSPENDED', 'BANNED', 'ERROR']

function statusDotColor(status) {
  switch (status) {
    case 'ACTIVE': return 'bg-emerald-500'
    case 'BANNED': return 'bg-red-500'
    case 'SUSPENDED': return 'bg-amber-500'
    case 'ERROR': return 'bg-orange-500'
    default: return 'bg-gray-500'
  }
}

function DetailRow({ label, value, mono = false, blur = false }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-[#141414] last:border-0">
      <span className="text-[#555] text-sm">{label}</span>
      {value || value === 0 ? (
        <span className={`text-sm text-white ${mono ? 'font-mono' : ''}`}>
          {blur ? <Blur>{value}</Blur> : value}
        </span>
      ) : (
        <span className="text-sm text-[#333] italic">---</span>
      )}
    </div>
  )
}

function EditableDetailRow({ label, value, onChange, mono = false, type = 'text', options, placeholder }) {
  const inputCls = `bg-[#111] border border-[#1a1a1a] rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#333] text-right ${mono ? 'font-mono' : ''}`
  return (
    <div className="flex justify-between items-center py-3 border-b border-[#141414] last:border-0">
      <span className="text-[#555] text-sm">{label}</span>
      {type === 'select' ? (
        <select value={value || ''} onChange={e => onChange(e.target.value)} className={`${inputCls} max-w-[220px]`}>
          <option value="">— None —</option>
          {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          type={type === 'password' ? 'password' : 'text'}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''}
          className={`${inputCls} w-[220px]`}
        />
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
        setEditing(false)
        setEditValues({})
      }
    }
  }, [searchParams, accounts])
  const { data: historyData } = useApi('/api/automation/posting-history?limit=5000')
  const { data: snapData } = useQuery({
    queryKey: ['scraper-snapshots-accounts', 60],
    queryFn: () => scraperGet('/analytics/legacy/snapshots', { days: 60 }),
    refetchInterval: 30_000,
  })
  const { data: contentData } = useApi('/api/automation/content-status')
  const { data: devicesData } = useApi('/api/devices')

  // Build identity map from content-status
  const { identityNames, usernameToIdentity } = useMemo(() => {
    const identities = contentData
      ? Array.isArray(contentData) ? contentData : contentData.identities || []
      : []
    const names = []
    const map = {}
    for (const identity of identities) {
      const name = identity.identityId || identity.identityName || identity.identity || identity.name || `Identity ${names.length + 1}`
      names.push(name)
      const accs = identity.accounts || []
      for (const acc of accs) {
        const username = typeof acc === 'string' ? acc : acc.username
        if (username) map[username] = name
      }
    }
    return { identityNames: names, usernameToIdentity: map }
  }, [contentData])

  const deviceMap = useMemo(() => {
    const map = {}
    if (Array.isArray(devicesData)) {
      devicesData.forEach(d => { map[d.udid] = d.name })
    }
    return map
  }, [devicesData])

  const [identityFilter, setIdentityFilter] = useState('ALL')
  const [deviceFilter, setDeviceFilter] = useState('ALL')

  // Build post count per username from posting history
  const postCounts = useMemo(() => {
    const counts = {}
    if (historyData?.entries) {
      for (const entry of historyData.entries) {
        if (entry.username) {
          counts[entry.username] = (counts[entry.username] || 0) + 1
        }
      }
    }
    return counts
  }, [historyData])

  const statusCounts = useMemo(() => {
    if (!accounts) return {}
    return STATUSES.reduce((acc, s) => {
      acc[s] = s === 'ALL' ? accounts.length : accounts.filter(a => a.status === s).length
      return acc
    }, {})
  }, [accounts])

  const identityCounts = useMemo(() => {
    if (!accounts) return {}
    const counts = { ALL: accounts.length }
    for (const name of identityNames) {
      counts[name] = accounts.filter(a => usernameToIdentity[a.username] === name).length
    }
    return counts
  }, [accounts, identityNames, usernameToIdentity])

  const accountDeviceMap = useMemo(() => {
    const map = {}
    if (accounts) {
      for (const a of accounts) {
        map[a.id] = a.deviceUdid ? (deviceMap[a.deviceUdid] || a.deviceUdid.slice(-8)) : null
      }
    }
    return map
  }, [accounts, deviceMap])

  const { deviceNames, deviceCounts } = useMemo(() => {
    if (!accounts) return { deviceNames: [], deviceCounts: {} }
    const nameSet = new Set()
    let noDevice = 0
    for (const a of accounts) {
      const name = accountDeviceMap[a.id]
      if (name) nameSet.add(name)
      else noDevice++
    }
    const names = [...nameSet].sort()
    const counts = { ALL: accounts.length }
    for (const name of names) {
      counts[name] = accounts.filter(a => accountDeviceMap[a.id] === name).length
    }
    if (noDevice > 0) counts['No Device'] = noDevice
    return { deviceNames: noDevice > 0 ? [...names, 'No Device'] : names, deviceCounts: counts }
  }, [accounts, accountDeviceMap])

  // Build device groups with KPIs for device view
  const deviceGroups = useMemo(() => {
    if (!accounts) return []
    const groups = {}
    for (const a of accounts) {
      const deviceName = a.deviceUdid ? (deviceMap[a.deviceUdid] || a.deviceUdid.slice(-8)) : null
      const key = deviceName || '__no_device'
      if (!groups[key]) {
        groups[key] = {
          name: deviceName || 'No Device',
          udid: a.deviceUdid || null,
          accounts: [],
          kpis: { total: 0, active: 0, suspended: 0, banned: 0, error: 0, schedulingEnabled: 0, totalViews: 0, totalFollowers: 0, totalPosts: 0 },
        }
      }
      groups[key].accounts.push(a)
      groups[key].kpis.total++
      const s = a.status?.toLowerCase()
      if (s === 'active') groups[key].kpis.active++
      else if (s === 'suspended') groups[key].kpis.suspended++
      else if (s === 'banned') groups[key].kpis.banned++
      else if (s === 'error') groups[key].kpis.error++
      if (a.schedulingEnabled) groups[key].kpis.schedulingEnabled++
      groups[key].kpis.totalViews += (a.viewsLast30Days ?? 0)
      groups[key].kpis.totalFollowers += (a.followerCount ?? 0)
      groups[key].kpis.totalPosts += (postCounts[a.username] || a.postCount || 0)
    }
    return Object.values(groups).sort((a, b) => b.kpis.total - a.kpis.total)
  }, [accounts, deviceMap, postCounts])

  function toggleDeviceExpanded(name) {
    setExpandedDevices(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const filtered = accounts
    ? (filter === 'ALL' ? accounts : accounts.filter(a => a.status === filter))
        .filter(a => identityFilter === 'ALL' || usernameToIdentity[a.username] === identityFilter)
        .filter(a => {
          if (deviceFilter === 'ALL') return true
          if (deviceFilter === 'No Device') return !a.deviceUdid
          return accountDeviceMap[a.id] === deviceFilter
        })
        .filter(a => a.username?.toLowerCase().includes(search.toLowerCase()))
    : []

  const selectedAccount = filtered.find(a => a.id === selectedId)

  const [viewMode, setViewMode] = useState('list') // 'list' | 'device'
  const [expandedDevices, setExpandedDevices] = useState(new Set())

  const [editingLink, setEditingLink] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [editing, setEditing] = useState(false)
  const [editValues, setEditValues] = useState({})

  function openLinkEditor(currentUrl) {
    setLinkValue(currentUrl || 'https://getmysocial.com/')
    setEditingLink(true)
  }

  async function handleSaveLink(id) {
    try {
      const account = accounts.find(a => a.id === id)
      if (!account) return
      await apiPut(`/api/accounts/${id}`, { ...account, storyLinkUrl: linkValue || null, necessaryLink: linkValue ? (['LINK_ACTIVE', 'LINK_REQUIRED'].includes(account.necessaryLink) ? account.necessaryLink : 'LINK_PENDING') : null })
      setEditingLink(false)
      refetch()
    } catch (err) {
      alert('Failed to update link: ' + err.message)
    }
  }

  async function handleDeleteLink(id) {
    try {
      const account = accounts.find(a => a.id === id)
      if (!account) return
      await apiPut(`/api/accounts/${id}`, { ...account, storyLinkUrl: null, necessaryLink: null })
      setEditingLink(false)
      refetch()
    } catch (err) {
      alert('Failed to remove link: ' + err.message)
    }
  }

  async function handleActivateLink(id, targetState = 'LINK_REQUIRED') {
    try {
      const account = accounts.find(a => a.id === id)
      if (!account || !account.storyLinkUrl || account.necessaryLink === targetState) return
      await apiPut(`/api/accounts/${id}`, { ...account, necessaryLink: targetState })
      refetch()
    } catch (err) {
      alert('Failed to activate link: ' + err.message)
    }
  }

  async function handleOpenContainer(account) {
    if (!account.deviceUdid || !account.containerId) {
      toast.error('Account has no device or container assigned')
      return
    }
    const device = (Array.isArray(devicesData) ? devicesData : []).find(d => d.udid === account.deviceUdid)
    try {
      await apiPost('/api/automation/execute', {
        actionName: 'SwitchCraneContainer',
        deviceUdid: account.deviceUdid,
        parameters: {
          containerId: account.containerId,
          containerName: account.craneContainer,
          proxyRotateUrl: device?.rotatingUrl || undefined,
        },
      })
      toast.success('Container opening queued')
    } catch (err) {
      toast.error('Failed: ' + err.message)
    }
  }

  function startEditing() {
    if (!selectedAccount) return
    setEditValues({
      password: selectedAccount.password || '',
      email: selectedAccount.email || '',
      phone: selectedAccount.phone || '',
      totpSecret: selectedAccount.totpSecret || '',
      craneContainer: selectedAccount.craneContainer || '',
      deviceUdid: selectedAccount.deviceUdid || '',
      proxySession: selectedAccount.proxySession || '',
    })
    setEditing(true)
  }

  async function saveEdits() {
    if (!selectedAccount) return
    try {
      await apiPut(`/api/accounts/${selectedAccount.id}`, { ...selectedAccount, ...editValues })
      setEditing(false)
      refetch()
    } catch (err) {
      alert('Failed to save: ' + err.message)
    }
  }

  async function handleToggleScheduling(id, current) {
    try {
      await apiPut(`/api/accounts/${id}/scheduling`, { schedulingEnabled: !current })
      refetch()
    } catch (err) {
      alert('Failed to toggle scheduling: ' + err.message)
    }
  }

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
    setEditingLink(false)
  }

  function handleIdentityFilterChange(name) {
    setIdentityFilter(name)
    setSelectedId(null)
    setEditingLink(false)
  }

  function handleDeviceFilterChange(name) {
    setDeviceFilter(name)
    setSelectedId(null)
    setEditingLink(false)
  }

  function handleSelectAccount(id) {
    setSelectedId(id)
    setEditingLink(false)
    setEditing(false)
    setEditValues({})
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Accounts</h1>
          <p className="text-xs text-[#333] mt-0.5">
            {accounts ? `${accounts.length} total accounts` : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'list' ? 'bg-white/10 text-white' : 'text-[#555] hover:text-white'
            }`}
          >
            <LayoutList size={14} />
            List
          </button>
          <button
            onClick={() => setViewMode('device')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'device' ? 'bg-white/10 text-white' : 'text-[#555] hover:text-white'
            }`}
          >
            <Smartphone size={14} />
            By Device
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'table' ? 'bg-white/10 text-white' : 'text-[#555] hover:text-white'
            }`}
          >
            <LayoutGrid size={14} />
            Table
          </button>
          <button
            onClick={() => setViewMode('stats')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'stats' ? 'bg-white/10 text-white' : 'text-[#555] hover:text-white'
            }`}
          >
            <BarChart3 size={14} />
            Stats
          </button>
        </div>
      </div>

      {/* Device View */}
      {viewMode === 'device' && (
        <div className="space-y-3" style={{ height: 'calc(100vh - 120px)', overflowY: 'auto' }}>
          {/* Device KPI summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {deviceGroups.map(group => {
              const k = group.kpis
              const healthPct = k.total > 0 ? Math.round((k.active / k.total) * 100) : 0
              return (
                <button
                  key={group.name}
                  onClick={() => toggleDeviceExpanded(group.name)}
                  className={`text-left bg-[#0a0a0a] border rounded-[10px] p-4 transition-colors ${
                    expandedDevices.has(group.name)
                      ? 'border-blue-500/30 bg-blue-500/5'
                      : 'border-[#1a1a1a] hover:border-[#333]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Smartphone size={14} className="text-[#555]" />
                    <span className="text-sm font-semibold text-white truncate">{group.name}</span>
                  </div>
                  {/* Health bar */}
                  <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full mb-3 overflow-hidden">
                    <div className="h-full flex">
                      {k.active > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(k.active / k.total) * 100}%` }} />}
                      {k.suspended > 0 && <div className="bg-amber-500 h-full" style={{ width: `${(k.suspended / k.total) * 100}%` }} />}
                      {k.error > 0 && <div className="bg-orange-500 h-full" style={{ width: `${(k.error / k.total) * 100}%` }} />}
                      {k.banned > 0 && <div className="bg-red-500 h-full" style={{ width: `${(k.banned / k.total) * 100}%` }} />}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[10px] text-[#555]">Total</span>
                      <span className="text-xs font-bold text-white">{k.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-[#555]">Active</span>
                      <span className="text-xs font-bold text-emerald-400">{k.active}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-[#555]">Banned</span>
                      <span className="text-xs font-bold text-red-400">{k.banned}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-[#555]">Error</span>
                      <span className="text-xs font-bold text-orange-400">{k.error}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-[#555]">Sched</span>
                      <span className="text-xs font-bold text-blue-400">{k.schedulingEnabled}/{k.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-[#555]">Health</span>
                      <span className={`text-xs font-bold ${healthPct >= 80 ? 'text-emerald-400' : healthPct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{healthPct}%</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#1a1a1a] grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs font-bold text-white">{k.totalViews.toLocaleString()}</p>
                      <p className="text-[9px] text-[#555] uppercase">Views</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{k.totalFollowers.toLocaleString()}</p>
                      <p className="text-[9px] text-[#555] uppercase">Followers</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{k.totalPosts}</p>
                      <p className="text-[9px] text-[#555] uppercase">Posts</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Expanded device account lists */}
          {deviceGroups.filter(g => expandedDevices.has(g.name)).map(group => (
            <div key={group.name} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
                <Smartphone size={14} className="text-[#555]" />
                <span className="text-sm font-semibold text-white">{group.name}</span>
                <span className="text-xs text-[#333] ml-auto">{group.kpis.total} accounts</span>
              </div>
              <div className="divide-y divide-[#141414]">
                {group.accounts.map(account => (
                  <button
                    key={account.id}
                    onClick={() => { setViewMode('list'); handleSelectAccount(account.id) }}
                    className="w-full text-left px-4 py-3 hover:bg-[#111] transition-colors flex items-center gap-3"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColor(account.status)}`} />
                    <span className="text-sm font-semibold text-white truncate min-w-[120px]"><Blur>{account.username}</Blur></span>
                    <span className="text-xs text-[#444]">{(account.viewsLast30Days ?? 0).toLocaleString()} views</span>
                    <span className="text-xs text-[#444]">{account.followerCount ?? 0} followers</span>
                    <span className="text-xs text-[#444]">{postCounts[account.username] || account.postCount || 0} posts</span>
                    <div className="ml-auto flex items-center gap-2">
                      {account.schedulingEnabled && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">Sched</span>
                      )}
                      <StatusBadge status={account.status} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {deviceGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <Smartphone size={48} className="text-[#1a1a1a] mb-4" />
              <p className="text-base text-[#333]">No devices found</p>
            </div>
          )}
        </div>
      )}

      {/* Main layout */}
      {viewMode === 'list' && <div className="flex flex-col lg:flex-row gap-3" style={{ height: 'calc(100vh - 120px)' }}>
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

          {/* Identity filter pills */}
          {identityNames.length > 0 && (
            <div className="flex gap-1.5 px-3 py-2.5 border-b border-[#1a1a1a] flex-wrap">
              {['ALL', ...identityNames].map(name => (
                <button
                  key={name}
                  onClick={() => handleIdentityFilterChange(name)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide transition-colors border ${
                    identityFilter === name
                      ? 'bg-white/10 text-white border-[#333]'
                      : 'bg-transparent text-[#555] border-[#1a1a1a] hover:text-white hover:border-[#333]'
                  }`}
                >
                  {name} {identityCounts[name] !== undefined ? identityCounts[name] : ''}
                </button>
              ))}
            </div>
          )}

          {/* Device filter pills */}
          {deviceNames.length > 0 && (
            <div className="flex gap-1.5 px-3 py-2.5 border-b border-[#1a1a1a] flex-wrap">
              {['ALL', ...deviceNames].map(name => (
                <button
                  key={name}
                  onClick={() => handleDeviceFilterChange(name)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide transition-colors border flex items-center gap-1 ${
                    deviceFilter === name
                      ? 'bg-white/10 text-white border-[#333]'
                      : 'bg-transparent text-[#555] border-[#1a1a1a] hover:text-white hover:border-[#333]'
                  }`}
                >
                  <Smartphone size={10} />
                  {name} {deviceCounts[name] !== undefined ? deviceCounts[name] : ''}
                </button>
              ))}
            </div>
          )}

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
                  onClick={() => handleSelectAccount(account.id)}
                  className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
                    selectedId === account.id
                      ? 'bg-blue-500/5 border-l-blue-500'
                      : 'hover:bg-[#111] border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColor(account.status)}`} />
                    <span className="text-sm font-semibold text-white truncate"><Blur>{account.username}</Blur></span>
                  </div>
                  <p className="text-xs text-[#444] mt-0.5 ml-[18px] truncate">
                    {usernameToIdentity[account.username] && <span className="text-[#555] font-medium"><Blur>{usernameToIdentity[account.username]}</Blur> · </span>}
                    {accountDeviceMap[account.id] && <span className="text-[#555] font-medium">{accountDeviceMap[account.id]} · </span>}
                    {postCounts[account.username] || account.postCount || 0} posts · {account.followerCount ?? 0} followers · {(account.viewsLast30Days ?? 0).toLocaleString()} views
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
                    <h2 className="text-xl font-bold text-white"><Blur>{selectedAccount.username}</Blur></h2>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={selectedAccount.status} />
                      {usernameToIdentity[selectedAccount.username] && (
                        <span className="text-[11px] bg-[#111] border border-[#1a1a1a] px-2 py-0.5 rounded-md text-[#888]">
                          <Blur>{usernameToIdentity[selectedAccount.username]}</Blur>
                        </span>
                      )}
                      {accountDeviceMap[selectedAccount.id] && (
                        <span className="text-[11px] bg-[#111] border border-[#1a1a1a] px-2 py-0.5 rounded-md text-[#888] flex items-center gap-1">
                          <Smartphone size={10} />
                          {accountDeviceMap[selectedAccount.id]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleScheduling(selectedAccount.id, selectedAccount.schedulingEnabled)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors border ${
                      selectedAccount.schedulingEnabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-transparent text-[#555] border-[#1a1a1a] hover:text-white hover:border-[#333]'
                    }`}
                    title={selectedAccount.schedulingEnabled ? 'Scheduling enabled' : 'Scheduling disabled'}
                  >
                    <Calendar size={12} />
                    {selectedAccount.schedulingEnabled ? 'Sched ON' : 'Sched OFF'}
                  </button>
                  <a
                    href={`https://instagram.com/${selectedAccount.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-md hover:bg-blue-500/10 text-[#333] hover:text-blue-400 transition-colors"
                    title="Open on Instagram"
                  >
                    <ExternalLink size={16} />
                  </a>
                  {selectedAccount.deviceUdid && selectedAccount.containerId && (
                    <button
                      onClick={() => handleOpenContainer(selectedAccount)}
                      className="p-2 rounded-md hover:bg-teal-500/10 text-[#333] hover:text-teal-400 transition-colors"
                      title="Rotate proxy & open container"
                    >
                      <Container size={16} />
                    </button>
                  )}
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
                  { label: 'Views (30d)', value: selectedAccount.viewsLast30Days },
                ].map(stat => (
                  <div key={stat.label} className="px-6 py-5 text-center">
                    <p className="text-3xl font-bold text-white">{(stat.value ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-[#555] uppercase tracking-wide mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Daily Views Chart */}
              <div className="px-8 py-5 border-b border-[#1a1a1a]">
                <span className="label-upper block mb-3">Daily Views</span>
                <AccountDailyViewsChart
                  account={selectedAccount}
                  snapshots={snapData?.data?.snapshots || snapData?.snapshots || []}
                />
              </div>

              {/* Story Link */}
              <div className="px-8 py-5 border-b border-[#1a1a1a]">
                <div className="flex items-center justify-between mb-3">
                  <span className="label-upper !mb-0">Story Link</span>
                </div>
                {editingLink ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={linkValue}
                      onChange={e => setLinkValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveLink(selectedAccount.id)}
                      autoFocus
                      className="flex-1 bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] focus:outline-none focus:border-[#333] font-mono"
                    />
                    <button
                      onClick={() => handleSaveLink(selectedAccount.id)}
                      className="px-3 py-2 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingLink(false)}
                      className="p-2 rounded-md hover:bg-[#1a1a1a] text-[#555] hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : selectedAccount.storyLinkUrl ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <a
                        href={selectedAccount.storyLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 font-mono truncate max-w-[300px] transition-colors"
                      >
                        <ExternalLink size={12} className="flex-shrink-0" />
                        <Blur>{selectedAccount.storyLinkUrl}</Blur>
                      </a>
                      <button
                        onClick={() => openLinkEditor(selectedAccount.storyLinkUrl)}
                        className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-[#555] hover:text-white transition-colors"
                        title="Edit link"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteLink(selectedAccount.id)}
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-[#555] hover:text-red-400 transition-colors"
                        title="Remove link"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedAccount.necessaryLink === 'LINK_ACTIVE' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          Lien en bio
                        </span>
                      ) : selectedAccount.necessaryLink === 'LINK_REQUIRED' ? (
                        <>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold tracking-wide uppercase bg-blue-500/10 text-blue-400 border-blue-500/20">
                            À mettre en bio
                          </span>
                          <button
                            onClick={() => handleActivateLink(selectedAccount.id, 'LINK_ACTIVE')}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                            title="Marquer ce lien comme déjà actif sur le compte"
                          >
                            <Check size={11} />
                            Marquer comme actif
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold tracking-wide uppercase bg-amber-500/10 text-amber-400 border-amber-500/20">
                            En attente
                          </span>
                          <button
                            onClick={() => handleActivateLink(selectedAccount.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                          >
                            Mettre en bio
                          </button>
                          <button
                            onClick={() => handleActivateLink(selectedAccount.id, 'LINK_ACTIVE')}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                            title="Marquer ce lien comme déjà actif sur le compte"
                          >
                            <Check size={11} />
                            Marquer comme actif
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openLinkEditor('')}
                    className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-[#1a1a1a] hover:border-[#333] text-[#555] hover:text-white transition-colors text-xs"
                  >
                    <Link size={12} />
                    Add link
                  </button>
                )}
              </div>

              {/* Key-value details */}
              <div className="px-8 py-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="label-upper !mb-0">Account Details</h3>
                  {!editing ? (
                    <button
                      onClick={startEditing}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-[#555] hover:text-white hover:bg-white/5 transition-colors font-medium"
                    >
                      <Pencil size={11} />
                      Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={saveEdits}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors font-semibold"
                      >
                        <Check size={11} />
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-[#555] hover:text-white hover:bg-white/5 transition-colors font-medium"
                      >
                        <X size={11} />
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {editing ? (
                  <>
                    <EditableDetailRow label="Password" value={editValues.password} onChange={v => setEditValues(p => ({ ...p, password: v }))} mono type="password" placeholder="password" />
                    <DetailRow label="Identity" value={usernameToIdentity[selectedAccount.username]} blur />
                    <EditableDetailRow label="Email" value={editValues.email} onChange={v => setEditValues(p => ({ ...p, email: v }))} placeholder="email@example.com" />
                    <EditableDetailRow label="Phone" value={editValues.phone} onChange={v => setEditValues(p => ({ ...p, phone: v }))} mono placeholder="+1234567890" />
                    <EditableDetailRow label="2FA Secret" value={editValues.totpSecret} onChange={v => setEditValues(p => ({ ...p, totpSecret: v }))} mono placeholder="TOTP secret" />
                    <EditableDetailRow label="Container" value={editValues.craneContainer} onChange={v => setEditValues(p => ({ ...p, craneContainer: v }))} mono placeholder="container name" />
                    <EditableDetailRow
                      label="Device"
                      value={editValues.deviceUdid}
                      onChange={v => setEditValues(p => ({ ...p, deviceUdid: v }))}
                      type="select"
                      options={(Array.isArray(devicesData) ? devicesData : []).map(d => ({ value: d.udid, label: `${d.name} — ${d.udid.slice(-8)}` }))}
                    />
                    <EditableDetailRow label="Proxy Session" value={editValues.proxySession} onChange={v => setEditValues(p => ({ ...p, proxySession: v }))} mono placeholder="proxy session" />
                    <DetailRow label="Created" value={selectedAccount.createdAt ? new Date(selectedAccount.createdAt).toLocaleDateString() : null} />
                    <DetailRow label="Last Login" value={selectedAccount.lastLoginAt ? new Date(selectedAccount.lastLoginAt).toLocaleString() : null} />
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center py-3 border-b border-[#141414]">
                      <span className="text-[#555] text-sm">Password</span>
                      {selectedAccount.password ? (
                        <span className="text-sm text-white font-mono"><Blur>{selectedAccount.password}</Blur></span>
                      ) : (
                        <span className="text-sm text-[#333] italic">no password</span>
                      )}
                    </div>
                    <DetailRow label="Identity" value={usernameToIdentity[selectedAccount.username]} blur />
                    <DetailRow label="Email" value={selectedAccount.email} blur />
                    <DetailRow label="Phone" value={selectedAccount.phone} mono blur />
                    <DetailRow
                      label="2FA Secret"
                      value={selectedAccount.totpSecret ? '••••••' + selectedAccount.totpSecret.slice(-4) : null}
                      mono
                      blur
                    />
                    <DetailRow label="Container" value={selectedAccount.craneContainer} mono blur />
                    <DetailRow label="Device" value={selectedAccount.deviceUdid ? `${deviceMap[selectedAccount.deviceUdid] || 'Unknown'} (${selectedAccount.deviceUdid})` : null} mono blur />
                    <DetailRow label="Proxy Session" value={selectedAccount.proxySession} mono blur />
                    <DetailRow
                      label="Created"
                      value={selectedAccount.createdAt ? new Date(selectedAccount.createdAt).toLocaleDateString() : null}
                    />
                    <DetailRow
                      label="Last Login"
                      value={selectedAccount.lastLoginAt ? new Date(selectedAccount.lastLoginAt).toLocaleString() : null}
                    />
                  </>
                )}
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
      </div>}

      {/* Table View */}
      {viewMode === 'table' && (
        <AccountsTableView
          accounts={accounts}
          loading={loading}
          postCounts={postCounts}
          usernameToIdentity={usernameToIdentity}
          accountDeviceMap={accountDeviceMap}
          identityNames={identityNames}
          deviceNames={deviceNames}
          onSelectAccount={(id) => { setViewMode('list'); handleSelectAccount(id) }}
        />
      )}

      {/* Stats View */}
      {viewMode === 'stats' && <ReelStatsView />}
    </div>
  )
}
