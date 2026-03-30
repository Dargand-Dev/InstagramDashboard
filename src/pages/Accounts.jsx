import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut, apiDelete } from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import StatusBadge from '@/components/shared/StatusBadge'
import HealthScoreBadge from '@/components/shared/HealthScoreBadge'
import TimeAgo from '@/components/shared/TimeAgo'
import EmptyState from '@/components/shared/EmptyState'
import {
  Users,
  Search,
  Trash2,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Eye,
  Heart,
  Image,
  Calendar,
  Activity,
  AlertTriangle,
  BarChart3,
  ArrowUpDown,
  X,
  Link2,
  CheckCircle,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { toast } from 'sonner'

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'SUSPENDED', 'BANNED', 'ERROR']

const STATUS_COLORS = {
  ACTIVE: '#22C55E',
  SUSPENDED: '#F59E0B',
  BANNED: '#EF4444',
  ERROR: '#EF4444',
  DISABLED: '#52525B',
}

const SORT_OPTIONS = [
  { value: 'health', label: 'Health Score' },
  { value: 'followers', label: 'Followers' },
  { value: 'views', label: 'Views' },
  { value: 'username', label: 'Username' },
]

function AccountRow({ account, selected, onSelect, onClick, isActive }) {
  const statusColor = STATUS_COLORS[account.status] || '#52525B'

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-l-2 ${
        isActive
          ? 'bg-[#111111] border-l-[#3B82F6]'
          : 'border-l-transparent hover:bg-[#111111]/50'
      }`}
      onClick={onClick}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={onSelect} />
      </div>
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: `${statusColor}15`, color: statusColor }}>
        {(account.username || '?')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#FAFAFA] truncate">{account.username || 'Unknown'}</p>
        <div className="flex items-center gap-2 text-xs text-[#52525B]">
          <span>{(account.followers || account.followerCount || 0).toLocaleString()} followers</span>
          <span>·</span>
          <span>{(account.views || account.viewsLast30Days || 0).toLocaleString()} views</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <HealthScoreBadge score={account.healthScore ?? account.score ?? 0} size={28} />
        <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: statusColor }} />
      </div>
    </div>
  )
}

function HealthBreakdown({ health }) {
  if (!health) return null
  const components = [
    { label: 'Views Trend', value: health.breakdown?.viewsTrendScore ?? health.viewsTrend ?? 0, color: '#3B82F6' },
    { label: 'Posting Success', value: health.breakdown?.postingFailuresScore ?? health.postingSuccessRate ?? 0, color: '#22C55E' },
    { label: 'Recency', value: health.breakdown?.daysSinceLastPostScore ?? health.recency ?? 0, color: '#F59E0B' },
    { label: 'Account Age', value: health.breakdown?.accountAgeScore ?? health.accountAge ?? 0, color: '#8B5CF6' },
  ]

  return (
    <div className="space-y-3">
      {components.map((c) => (
        <div key={c.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#52525B]">{c.label}</span>
            <span className="text-[#A1A1AA] font-medium">{c.value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${c.value}%`, backgroundColor: c.color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function ViewsChart({ data }) {
  if (!data || data.length === 0) return null
  const avg = data.reduce((s, d) => s + (d.views || 0), 0) / data.length

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#52525B' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#52525B' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ backgroundColor: '#111111', border: '1px solid #1a1a1a', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#A1A1AA' }}
        />
        <Bar dataKey="views" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={(entry.views || 0) < avg ? '#EF4444' : '#3B82F6'} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function AccountDetail({ account }) {
  const queryClient = useQueryClient()

  const { data: health } = useQuery({
    queryKey: ['account-health', account?.id],
    queryFn: () => apiGet(`/api/accounts/${account.id}/health`),
    enabled: !!account?.id,
    select: (res) => res.data || res,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => apiPut(`/api/accounts/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Status updated')
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => apiDelete(`/api/accounts/${id}`),
    onSuccess: () => {
      toast.success('Account deleted')
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })

  const [deleteConfirm, setDeleteConfirm] = useState(false)

  if (!account) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState icon={Users} title="Select an account" description="Choose an account from the list to view details." />
      </div>
    )
  }

  const statusColor = STATUS_COLORS[account.status] || '#52525B'
  const viewsData = health?.viewsHistory || health?.dailyViews || []
  const alerts = health?.alerts || []

  return (
    <ScrollArea className="flex-1">
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold"
              style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
            >
              {(account.username || '?')[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#FAFAFA]">{account.username}</h2>
              <StatusBadge status={account.status} />
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-[#1a1a1a] text-[#A1A1AA] h-8")}>
                Change Status <ChevronDown className="w-3 h-3 ml-1" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#111111] border-[#1a1a1a]">
              {['ACTIVE', 'SUSPENDED', 'DISABLED'].map((s) => (
                <DropdownMenuItem
                  key={s}
                  className="text-xs text-[#A1A1AA] focus:bg-[#1a1a1a] focus:text-[#FAFAFA]"
                  onClick={() => statusMutation.mutate({ id: account.id, status: s })}
                >
                  {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Posts', value: account.posts || account.postCount || 0, icon: Image },
            { label: 'Followers', value: (account.followers || account.followerCount || 0).toLocaleString(), icon: Users },
            { label: 'Views (30d)', value: (account.views || account.viewsLast30Days || 0).toLocaleString(), icon: Eye },
            { label: 'Health', value: health?.score ?? account.healthScore ?? 0, icon: Activity, isHealth: true },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3 text-center">
              <stat.icon className="w-3.5 h-3.5 text-[#52525B] mx-auto mb-1" />
              <p className={`text-sm font-semibold ${stat.isHealth ? '' : 'text-[#FAFAFA]'}`}
                style={stat.isHealth ? { color: stat.value >= 80 ? '#22C55E' : stat.value >= 50 ? '#F59E0B' : '#EF4444' } : undefined}
              >
                {stat.value}
              </p>
              <p className="text-[10px] text-[#52525B]">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Health Score Section */}
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#FAFAFA]">Health Score</h3>
            <HealthScoreBadge score={health?.score ?? account.healthScore ?? 0} size={32} />
          </div>

          {viewsData.length > 0 && (
            <div>
              <p className="text-xs text-[#52525B] mb-2">Views — Last 14 days</p>
              <ViewsChart data={viewsData} />
            </div>
          )}

          {alerts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-[#52525B]">Alerts</p>
              {alerts.map((alert, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-md bg-[#EF4444]/5 border border-[#EF4444]/10 text-[#EF4444]">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>{alert.message || alert}</span>
                </div>
              ))}
            </div>
          )}

          <HealthBreakdown health={health} />
        </div>

        {/* Follower Growth */}
        {(health?.followerGrowth || []).length > 0 && (
          <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
            <h3 className="text-sm font-medium text-[#FAFAFA] mb-3">Follower Growth</h3>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={health.followerGrowth} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#52525B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#52525B' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#111111', border: '1px solid #1a1a1a', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="followers" fill="#8B5CF6" radius={[3, 3, 0, 0]} fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Story Link */}
        {account.storyLink && (
          <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
            <h3 className="text-sm font-medium text-[#FAFAFA] mb-2 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-[#52525B]" /> Story Link
            </h3>
            <p className="text-xs text-[#3B82F6] break-all">{account.storyLink}</p>
          </div>
        )}

        {/* Account Details */}
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-medium text-[#FAFAFA] mb-1">Account Details</h3>
          {[
            ['Username', account.username],
            ['Email', account.email],
            ['Phone', account.phone],
            ['Proxy', account.proxy],
            ['Created', account.createdAt ? new Date(account.createdAt).toLocaleDateString() : null],
            ['Scheduling', account.schedulingEnabled ? 'Enabled' : 'Disabled'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between py-1 border-b border-[#1a1a1a] last:border-0">
              <span className="text-xs text-[#52525B]">{label}</span>
              <span className="text-xs text-[#A1A1AA]">{value || '—'}</span>
            </div>
          ))}
        </div>

        {/* Delete */}
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10 w-full"
            onClick={() => setDeleteConfirm(true)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Account
          </Button>
        </div>

        <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
          <DialogContent className="bg-[#0A0A0A] border-[#1a1a1a] sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-[#FAFAFA]">Delete Account</DialogTitle>
              <DialogDescription className="text-[#52525B]">
                Are you sure you want to delete <span className="text-[#FAFAFA]">{account.username}</span>? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" className="border-[#1a1a1a] text-[#A1A1AA]" onClick={() => setDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.mutate(account.id)
                  setDeleteConfirm(false)
                }}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  )
}

export default function Accounts() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('health')
  const [selectedId, setSelectedId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkAction, setBulkAction] = useState(null)

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiGet('/api/accounts'),
    select: (res) => {
      const list = res.data || res || []
      return Array.isArray(list) ? list : []
    },
  })

  const filtered = useMemo(() => {
    let list = accounts
    if (statusFilter !== 'ALL') {
      list = list.filter((a) => a.status === statusFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((a) => (a.username || '').toLowerCase().includes(q))
    }
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'health': return (b.healthScore ?? b.score ?? 0) - (a.healthScore ?? a.score ?? 0)
        case 'followers': return (b.followers || b.followerCount || 0) - (a.followers || a.followerCount || 0)
        case 'views': return (b.views || b.viewsLast30Days || 0) - (a.views || a.viewsLast30Days || 0)
        case 'username': return (a.username || '').localeCompare(b.username || '')
        default: return 0
      }
    })
    return list
  }, [accounts, statusFilter, search, sortBy])

  const selectedAccount = useMemo(() => accounts.find((a) => a.id === selectedId), [accounts, selectedId])

  useEffect(() => {
    const idFromUrl = searchParams.get('id')
    if (idFromUrl && accounts.length > 0) {
      const match = accounts.find((a) => a.id === idFromUrl)
      if (match) setSelectedId(match.id)
    }
  }, [accounts, searchParams])

  useEffect(() => {
    const idFromUrl = searchParams.get('id')
    if (idFromUrl) return
    if (selectedId && filtered.length > 0 && !filtered.find((a) => a.id === selectedId)) {
      setSelectedId(null)
    }
  }, [filtered, selectedId, searchParams])

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)))
    }
  }, [filtered, selectedIds.size])

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }) => {
      await Promise.all(ids.map((id) => apiPut(`/api/accounts/${id}/status`, { status })))
    },
    onSuccess: () => {
      toast.success('Accounts updated')
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setSelectedIds(new Set())
      setBulkAction(null)
    },
  })

  const bulkSchedulingMutation = useMutation({
    mutationFn: async ({ ids, enabled }) => {
      await Promise.all(ids.map((id) => apiPut(`/api/accounts/${id}/scheduling`, { enabled })))
    },
    onSuccess: () => {
      toast.success('Scheduling updated')
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setSelectedIds(new Set())
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map((id) => apiDelete(`/api/accounts/${id}`)))
    },
    onSuccess: () => {
      toast.success('Accounts deleted')
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setSelectedIds(new Set())
      setBulkAction(null)
    },
  })

  const statusCounts = useMemo(() => {
    const counts = { ALL: accounts.length }
    accounts.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1
    })
    return counts
  }, [accounts])

  return (
    <div className="space-y-0 h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1a1a1a]">
        <h1 className="text-xl font-semibold text-[#FAFAFA]">Accounts</h1>
        <p className="text-sm text-[#52525B] mt-0.5">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex h-[calc(100%-4.5rem)]">
        {/* Left panel - account list */}
        <div className="w-[380px] border-r border-[#1a1a1a] flex flex-col shrink-0">
          {/* Search + filters */}
          <div className="p-3 space-y-3 border-b border-[#1a1a1a]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525B]" />
              <Input
                placeholder="Search accounts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#52525B] h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === s
                      ? 'bg-[#3B82F6]/10 text-[#3B82F6]'
                      : 'text-[#52525B] hover:text-[#A1A1AA] hover:bg-[#111111]'
                  }`}
                >
                  {s} {statusCounts[s] != null ? `(${statusCounts[s]})` : ''}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3 h-3 text-[#52525B]" />
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-7 text-xs border-[#1a1a1a] bg-transparent text-[#A1A1AA] w-auto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111111] border-[#1a1a1a]">
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs text-[#A1A1AA] focus:bg-[#1a1a1a] focus:text-[#FAFAFA]">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Checkbox
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onCheckedChange={toggleSelectAll}
              />
            </div>
          </div>

          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="px-3 py-2 bg-[#3B82F6]/5 border-b border-[#3B82F6]/10 flex items-center gap-2">
              <span className="text-xs text-[#3B82F6] font-medium">{selectedIds.size} selected</span>
              <div className="ml-auto flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-6 text-xs text-[#A1A1AA]")}>
                    Status
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#111111] border-[#1a1a1a]">
                    {['ACTIVE', 'SUSPENDED', 'DISABLED'].map((s) => (
                      <DropdownMenuItem
                        key={s}
                        className="text-xs text-[#A1A1AA] focus:bg-[#1a1a1a]"
                        onClick={() => bulkStatusMutation.mutate({ ids: [...selectedIds], status: s })}
                      >
                        {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-6 text-xs text-[#A1A1AA]")}>
                    Scheduling
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#111111] border-[#1a1a1a]">
                    <DropdownMenuItem className="text-xs text-[#A1A1AA] focus:bg-[#1a1a1a]" onClick={() => bulkSchedulingMutation.mutate({ ids: [...selectedIds], enabled: true })}>
                      Enable
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs text-[#A1A1AA] focus:bg-[#1a1a1a]" onClick={() => bulkSchedulingMutation.mutate({ ids: [...selectedIds], enabled: false })}>
                      Disable
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                  onClick={() => setBulkAction('delete')}
                >
                  Delete
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-[#52525B]" onClick={() => setSelectedIds(new Set())}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Account list */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full bg-[#111111]" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title={search ? 'No accounts match' : 'No accounts'}
                description={search ? 'Try a different search term.' : 'No accounts found in this category.'}
              />
            ) : (
              filtered.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  selected={selectedIds.has(account.id)}
                  onSelect={() => toggleSelect(account.id)}
                  onClick={() => setSelectedId(account.id)}
                  isActive={selectedId === account.id}
                />
              ))
            )}
          </ScrollArea>
        </div>

        {/* Right panel - account detail */}
        <AccountDetail account={selectedAccount} />
      </div>

      {/* Bulk delete confirm */}
      <Dialog open={bulkAction === 'delete'} onOpenChange={() => setBulkAction(null)}>
        <DialogContent className="bg-[#0A0A0A] border-[#1a1a1a] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#FAFAFA]">Delete {selectedIds.size} Accounts</DialogTitle>
            <DialogDescription className="text-[#52525B]">This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" className="border-[#1a1a1a] text-[#A1A1AA]" onClick={() => setBulkAction(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => bulkDeleteMutation.mutate([...selectedIds])}
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
