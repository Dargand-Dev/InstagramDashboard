import { useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
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

const COLUMNS = [
  { key: 'username', label: 'Username', sortable: true },
  { key: 'deviceName', label: 'Device', sortable: true },
  { key: 'totalViews', label: 'Views', sortable: true, numeric: true },
  { key: 'followersCount', label: 'Followers', sortable: true, numeric: true },
  { key: 'postsCount', label: 'Posts', sortable: true, numeric: true },
  { key: 'lastPostingRun', label: 'Last Run', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
]

export default function AccountTable({ accounts, devices, selectedUsernames, onToggle, onToggleAll }) {
  const [sortCol, setSortCol] = useState('username')
  const [sortDir, setSortDir] = useState('asc')
  const { isIncognito } = useIncognito()

  const deviceMap = {}
  for (const d of (devices || [])) deviceMap[d.udid] = d.name

  // Add deviceName to accounts for sorting
  const enriched = accounts.map(a => ({
    ...a,
    deviceName: deviceMap[a.deviceUdid] || 'Unknown',
  }))

  // Sort
  const sorted = [...enriched].sort((a, b) => {
    let va = a[sortCol]
    let vb = b[sortCol]
    if (va == null) va = ''
    if (vb == null) vb = ''
    const col = COLUMNS.find(c => c.key === sortCol)
    if (col?.numeric) {
      va = Number(va) || 0
      vb = Number(vb) || 0
    }
    if (sortCol === 'lastPostingRun') {
      va = va ? new Date(va).getTime() : 0
      vb = vb ? new Date(vb).getTime() : 0
    }
    if (typeof va === 'string') va = va.toLowerCase()
    if (typeof vb === 'string') vb = vb.toLowerCase()
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  function handleSort(key) {
    if (sortCol === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(key)
      setSortDir('asc')
    }
  }

  const allSelected = accounts.length > 0 && accounts.every(a => selectedUsernames.has(a.username))

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-card">
              <th className="w-8 px-3 py-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => onToggleAll(accounts.map(a => a.username))}
                />
              </th>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${col.sortable ? 'cursor-pointer hover:text-foreground select-none' : ''} ${col.numeric ? 'text-right' : ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortCol === col.key && (
                      sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="text-center text-muted-foreground py-8">
                  No accounts found
                </td>
              </tr>
            ) : (
              sorted.map(a => {
                const lastRun = formatTimeAgo(a.lastPostingRun)
                return (
                <tr
                  key={a.id}
                  className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer"
                  onClick={() => onToggle(a.username)}
                >
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selectedUsernames.has(a.username)}
                      className="pointer-events-none"
                    />
                  </td>
                  <td className={`px-3 py-2 font-medium text-foreground ${isIncognito ? 'incognito-blur' : ''}`}>
                    {a.username}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{a.deviceName}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{a.totalViews?.toLocaleString() ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{a.followersCount?.toLocaleString() ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{a.postsCount ?? '—'}</td>
                  <td className={`px-3 py-2 ${lastRun.color || 'text-muted-foreground'}`}>{lastRun.text}</td>
                  <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                </tr>
                )
              }))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
