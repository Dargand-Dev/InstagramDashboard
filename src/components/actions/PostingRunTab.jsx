import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Rocket, Loader2, CheckCircle, XCircle, ExternalLink, Users, LayoutGrid, Table2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiPost } from '@/hooks/useApi'
import { useApi } from '@/hooks/useApi'
import { saveWorkflowRun } from '@/utils/workflow'
import DeviceGroupList from './DeviceGroupList'
import AccountTable from './AccountTable'

const FILTER_OPTIONS = [
  { key: 'active', label: 'Active' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'never_posted', label: 'Never posted' },
]

export default function PostingRunTab({ devices, accounts, lockStatus, onRefreshLock }) {
  const navigate = useNavigate()
  const { data: contentStatus } = useApi('/api/automation/content-status')

  // State
  const [search, setSearch] = useState('')
  const [view, setView] = useState('device') // 'device' | 'table'
  const [filters, setFilters] = useState(new Set(['active', 'scheduled']))
  const [identityFilter, setIdentityFilter] = useState('all')
  const [selectiveMode, setSelectiveMode] = useState(true)
  const [selectedUsernames, setSelectedUsernames] = useState(new Set())
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerResult, setTriggerResult] = useState(null)

  // Identities from content-status
  const identities = useMemo(() => {
    if (!contentStatus?.identities) return []
    return Object.keys(contentStatus.identities)
  }, [contentStatus])

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    let list = accounts || []

    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a => a.username.toLowerCase().includes(q))
    }

    // Status filters
    if (filters.size > 0) {
      list = list.filter(a => {
        if (filters.has('active') && a.status === 'ACTIVE') return true
        if (filters.has('scheduled') && a.schedulingEnabled) return true
        if (filters.has('never_posted') && !a.lastPostingRun) return true
        return false
      })
    }

    // Identity filter
    if (identityFilter && identityFilter !== 'all') {
      list = list.filter(a => a.identityId === identityFilter)
    }

    return list
  }, [accounts, search, filters, identityFilter])

  // Accounts with no post in 12h+
  const staleAccounts = useMemo(() => {
    const twelveHours = 12 * 60 * 60 * 1000
    return filteredAccounts.filter(a => {
      if (!a.lastPostingRun) return true
      return Date.now() - new Date(a.lastPostingRun).getTime() >= twelveHours
    })
  }, [filteredAccounts])

  const selectStale = useCallback(() => {
    setSelectiveMode(true)
    setSelectedUsernames(new Set(staleAccounts.map(a => a.username)))
  }, [staleAccounts])

  function toggleFilter(key) {
    setFilters(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleUsername(username) {
    setSelectedUsernames(prev => {
      const next = new Set(prev)
      next.has(username) ? next.delete(username) : next.add(username)
      return next
    })
  }

  function toggleAllUsernames(usernames) {
    setSelectedUsernames(prev => {
      const next = new Set(prev)
      const allSelected = usernames.every(u => next.has(u))
      usernames.forEach(u => allSelected ? next.delete(u) : next.add(u))
      return next
    })
  }

  async function handleTrigger() {
    onRefreshLock?.()
    setTriggerLoading(true)
    setTriggerResult(null)
    try {
      const body = selectiveMode && selectedUsernames.size > 0
        ? { usernames: [...selectedUsernames] }
        : {}
      const data = await apiPost('/api/automation/trigger', body)
      if (data.runId) saveWorkflowRun(data.runId, 'PostReel')
      const label = selectiveMode && selectedUsernames.size > 0
        ? `Manual run triggered for ${selectedUsernames.size} account(s)`
        : 'Manual run triggered (all accounts)'
      setTriggerResult({ type: 'success', message: label, runId: data.runId })
    } catch (err) {
      setTriggerResult({ type: 'error', message: err.message })
    } finally { setTriggerLoading(false) }
  }

  const isAllLocked = lockStatus?.devices && devices?.length > 0 && devices.every(d => lockStatus.devices[d.udid])
  const triggerDisabled = triggerLoading || (!selectiveMode && isAllLocked) || (selectiveMode && selectedUsernames.size === 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search accounts..."
            className="pl-8 text-xs h-8"
          />
        </div>

        {/* View toggle */}
        <ToggleGroup type="single" value={view} onValueChange={v => v && setView(v)} className="h-8">
          <ToggleGroupItem value="device" aria-label="Group by device" className="h-8 w-8 p-0">
            <LayoutGrid size={14} />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view" className="h-8 w-8 p-0">
            <Table2 size={14} />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_OPTIONS.map(f => (
          <Badge
            key={f.key}
            variant={filters.has(f.key) ? 'default' : 'outline'}
            className="cursor-pointer text-[10px] select-none"
            onClick={() => toggleFilter(f.key)}
          >
            {f.label}
          </Badge>
        ))}

        {identities.length > 0 && (
          <Select value={identityFilter} onValueChange={setIdentityFilter}>
            <SelectTrigger className="h-6 w-[130px] text-[10px]">
              <SelectValue placeholder="Identity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All identities</SelectItem>
              {identities.map(id => (
                <SelectItem key={id} value={id} className="text-xs">{id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Selection bar */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-mono">
            {selectedUsernames.size}/{filteredAccounts.length} selected
          </span>
          {staleAccounts.length > 0 && (
            <button
              onClick={selectStale}
              className="flex items-center gap-1 text-[10px] text-orange-400 hover:text-orange-300 font-semibold uppercase tracking-wider transition-colors"
            >
              <Clock size={10} />
              Stale 12h+ ({staleAccounts.length})
            </button>
          )}
          <button
            onClick={() => toggleAllUsernames(filteredAccounts.map(a => a.username))}
            className="text-[10px] text-muted-foreground hover:text-foreground font-semibold uppercase tracking-wider transition-colors"
          >
            {filteredAccounts.length > 0 && filteredAccounts.every(a => selectedUsernames.has(a.username))
              ? 'Clear all' : 'Select all'}
          </button>
        </div>
      </div>

      {/* Content */}
      {view === 'device' ? (
        <DeviceGroupList
          devices={devices}
          accounts={filteredAccounts}
          selectedUsernames={selectedUsernames}
          onToggle={toggleUsername}
          onToggleAll={toggleAllUsernames}
        />
      ) : (
        <AccountTable
          accounts={filteredAccounts}
          devices={devices}
          selectedUsernames={selectedUsernames}
          onToggle={toggleUsername}
          onToggleAll={toggleAllUsernames}
        />
      )}

      {/* Footer */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t border-border -mx-4 px-4 py-3 mt-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Mode toggle */}
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <button
                onClick={() => { setSelectiveMode(false); setSelectedUsernames(new Set()) }}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                  !selectiveMode ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users size={11} />
                All Eligible
              </button>
              <button
                onClick={() => setSelectiveMode(true)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                  selectiveMode ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Selective
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {selectiveMode
                ? `${selectedUsernames.size} account${selectedUsernames.size !== 1 ? 's' : ''} selected`
                : 'All eligible accounts'}
            </span>
          </div>

          <Button
            onClick={handleTrigger}
            disabled={triggerDisabled}
            className="gap-2"
            size="sm"
          >
            {triggerLoading ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
            {triggerLoading ? 'Triggering...' : selectiveMode && selectedUsernames.size > 0
              ? `Trigger Run (${selectedUsernames.size})`
              : 'Trigger Manual Run'}
          </Button>
        </div>

        {/* Result */}
        {triggerResult && (
          <div className={`flex items-center justify-between mt-2 p-2.5 rounded-md border text-xs font-medium ${
            triggerResult.type === 'error'
              ? 'bg-destructive/5 text-destructive border-destructive/15'
              : 'bg-emerald-500/5 text-emerald-400 border-emerald-500/15'
          }`}>
            <div className="flex items-center gap-2">
              {triggerResult.type === 'error' ? <XCircle size={14} /> : <CheckCircle size={14} />}
              {triggerResult.message}
            </div>
            {triggerResult.runId && (
              <button
                onClick={() => navigate('/activity?tab=logs')}
                className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors font-semibold"
              >
                View logs <ExternalLink size={10} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
