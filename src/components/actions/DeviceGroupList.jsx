import { useState } from 'react'
import { Smartphone, ChevronRight } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useIncognito } from '@/contexts/IncognitoContext'
import StatusBadge from '@/components/StatusBadge'

function formatTimeAgo(dateStr) {
  if (!dateStr) return { text: 'Never', color: 'text-red-400' }
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const color = hrs >= 24 ? 'text-red-400' : hrs >= 12 ? 'text-orange-400' : ''
  if (mins < 60) return { text: `${mins}m ago`, color }
  if (hrs < 24) return { text: `${hrs}h ago`, color }
  const days = Math.floor(hrs / 24)
  return { text: `${days}d ago`, color }
}

function AccountRow({ account, selected, onToggle }) {
  const { isIncognito } = useIncognito()
  const lastRun = formatTimeAgo(account.lastPostingRun)

  return (
    <div
      onClick={() => onToggle(account.username)}
      className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors border-b border-border/50 last:border-b-0 cursor-pointer"
    >
      <Checkbox
        checked={selected}
        className="shrink-0 pointer-events-none"
      />
      <span className={`text-xs font-medium text-foreground min-w-[120px] ${isIncognito ? 'incognito-blur' : ''}`}>
        {account.username}
      </span>
      <div className="flex items-center gap-3 flex-1 text-[10px] text-muted-foreground">
        <span title="Views">{account.totalViews?.toLocaleString() ?? '—'}</span>
        <span title="Followers">{account.followersCount?.toLocaleString() ?? '—'}</span>
        <span title="Posts">{account.postsCount ?? '—'}</span>
        <span title="Last run" className={`ml-auto ${lastRun.color || 'text-muted-foreground'}`}>{lastRun.text}</span>
      </div>
      <StatusBadge status={account.status} />
    </div>
  )
}

export default function DeviceGroupList({ devices, accounts, selectedUsernames, onToggle, onToggleAll }) {
  const [openDevices, setOpenDevices] = useState(() => new Set((devices || []).map(d => d.udid)))

  function toggleDevice(udid) {
    setOpenDevices(prev => {
      const next = new Set(prev)
      next.has(udid) ? next.delete(udid) : next.add(udid)
      return next
    })
  }

  // Group accounts by device
  const grouped = {}
  for (const d of (devices || [])) {
    grouped[d.udid] = { device: d, accounts: [] }
  }
  // Accounts without a known device go to "Unknown"
  const unknown = []
  for (const a of accounts) {
    if (a.deviceUdid && grouped[a.deviceUdid]) {
      grouped[a.deviceUdid].accounts.push(a)
    } else {
      unknown.push(a)
    }
  }

  const groups = Object.values(grouped).filter(g => g.accounts.length > 0)
  if (unknown.length > 0) {
    groups.push({ device: { udid: '__unknown', name: 'Unknown Device' }, accounts: unknown })
  }

  return (
    <div className="space-y-2">
      {groups.map(({ device, accounts: deviceAccounts }) => {
        const selectedCount = deviceAccounts.filter(a => selectedUsernames.has(a.username)).length
        const allSelected = deviceAccounts.length > 0 && selectedCount === deviceAccounts.length
        const isOpen = openDevices.has(device.udid)

        return (
          <Collapsible key={device.udid} open={isOpen} onOpenChange={() => toggleDevice(device.udid)}>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <CollapsibleTrigger className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-accent/30 transition-colors text-left">
                <ChevronRight size={14} className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                <Smartphone size={14} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground flex-1">
                  {device.name}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {selectedCount}/{deviceAccounts.length}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => {
                    e.stopPropagation()
                    e.preventDefault()
                    onToggleAll(deviceAccounts.map(a => a.username))
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onToggleAll(deviceAccounts.map(a => a.username)) } }}
                  className="text-[10px] text-muted-foreground hover:text-foreground font-semibold uppercase tracking-wider px-1.5 transition-colors cursor-pointer"
                >
                  {allSelected ? 'Clear' : 'All'}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border">
                  {deviceAccounts.map(a => (
                    <AccountRow
                      key={a.id}
                      account={a}
                      selected={selectedUsernames.has(a.username)}
                      onToggle={onToggle}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )
      })}
      {groups.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">No accounts found</p>
      )}
    </div>
  )
}
