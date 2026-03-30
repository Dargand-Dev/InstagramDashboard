import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import DataTable from '@/components/shared/DataTable'
import StatusBadge from '@/components/shared/StatusBadge'
import TimeAgo from '@/components/shared/TimeAgo'
import EmptyState from '@/components/shared/EmptyState'
import {
  FileText, Download, CheckCircle, XCircle, Clock,
  Search, Filter, X,
} from 'lucide-react'

function formatDuration(ms) {
  if (!ms) return '—'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return `${m}m ${rem}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function exportCSV(records) {
  const headers = ['Date', 'Username', 'Identity', 'Status', 'Reel', 'Duration']
  const rows = records.map(r => [
    r.date || r.postedAt || '', r.username || r.accountName || '',
    r.identity || '', r.status || '', r.driveFilename || r.baseVideo || r.reelTitle || '',
    r.duration ? formatDuration(r.duration) : '',
  ])
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `posting-history-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function PostingHistory() {
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [usernameFilter, setUsernameFilter] = useState('')

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['posting-history'],
    queryFn: () => apiGet('/api/automation/posting-history?limit=200'),
  })

  const records = useMemo(() => {
    const raw = historyData?.data || historyData || {}
    if (Array.isArray(raw)) return raw
    return raw.entries || []
  }, [historyData])

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (statusFilter && (r.status || '').toUpperCase() !== statusFilter) return false
      if (usernameFilter && !(r.username || r.accountName || '').toLowerCase().includes(usernameFilter.toLowerCase())) return false
      return true
    })
  }, [records, statusFilter, usernameFilter])

  // Summary stats
  const summary = useMemo(() => {
    const total = filteredRecords.length
    const success = filteredRecords.filter(r => (r.status || '').toUpperCase() === 'SUCCESS' || (r.status || '').toUpperCase() === 'COMPLETED').length
    const rate = total > 0 ? ((success / total) * 100).toFixed(1) : 0
    const durations = filteredRecords.filter(r => r.duration).map(r => r.duration)
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
    return { total, success, rate, avgDuration }
  }, [filteredRecords])

  const uniqueStatuses = useMemo(() => {
    const set = new Set(records.map(r => (r.status || '').toUpperCase()).filter(Boolean))
    return [...set]
  }, [records])

  const columns = useMemo(() => [
    {
      accessorKey: 'date',
      header: 'Date',
      accessorFn: row => row.date || row.postedAt || row.createdAt,
      cell: ({ row }) => <TimeAgo date={row.original.date || row.original.postedAt || row.original.createdAt} />,
    },
    {
      accessorKey: 'username',
      header: 'Username',
      accessorFn: row => row.username || row.accountName,
      cell: ({ row }) => (
        <span className="text-[#FAFAFA] font-medium">{row.original.username || row.original.accountName || '—'}</span>
      ),
    },
    {
      accessorKey: 'identity',
      header: 'Identity',
      cell: ({ row }) => <span>{row.original.identity || '—'}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'reelTitle',
      header: 'Reel',
      accessorFn: row => row.driveFilename || row.baseVideo || row.reelTitle || row.contentId,
      cell: ({ row }) => (
        <span className="truncate max-w-[200px] block">{row.original.driveFilename || row.original.baseVideo || row.original.reelTitle || '—'}</span>
      ),
    },
    {
      accessorKey: 'duration',
      header: 'Duration',
      cell: ({ row }) => <span className="tabular-nums">{formatDuration(row.original.duration)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="xs"
          className="text-[#52525B] hover:text-[#A1A1AA]"
          onClick={() => setSelectedRecord(row.original)}
        >
          Details
        </Button>
      ),
      enableSorting: false,
    },
  ], [])

  const hasFilters = statusFilter || usernameFilter
  const clearFilters = () => { setStatusFilter(''); setUsernameFilter('') }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#FAFAFA]">Posting History</h1>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-[#52525B] hover:text-[#A1A1AA]"
          onClick={() => exportCSV(filteredRecords)}
          disabled={!filteredRecords.length}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: FileText, label: 'Total Posts', value: summary.total, color: '#3B82F6' },
          { icon: CheckCircle, label: 'Successful', value: summary.success, color: '#22C55E' },
          { icon: XCircle, label: 'Success Rate', value: `${summary.rate}%`, color: parseFloat(summary.rate) >= 80 ? '#22C55E' : '#F59E0B' },
          { icon: Clock, label: 'Avg Duration', value: formatDuration(summary.avgDuration), color: '#8B5CF6' },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label} className="bg-[#111111] border-[#1a1a1a]">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <p className="text-xs text-[#52525B]">{label}</p>
                <p className="text-sm font-semibold text-[#FAFAFA]">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525B]" />
              <Input
                placeholder="Filter username..."
                value={usernameFilter}
                onChange={e => setUsernameFilter(e.target.value)}
                className="pl-9 h-8 w-48 bg-[#0A0A0A] border-[#1a1a1a] text-sm text-[#FAFAFA] placeholder:text-[#52525B]"
              />
            </div>
            <div className="flex items-center bg-[#0A0A0A] rounded-lg border border-[#1a1a1a] p-0.5">
              <button
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${!statusFilter ? 'bg-[#1a1a1a] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'}`}
                onClick={() => setStatusFilter('')}
              >
                All
              </button>
              {uniqueStatuses.map(s => (
                <button
                  key={s}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${statusFilter === s ? 'bg-[#1a1a1a] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            {hasFilters && (
              <Button variant="ghost" size="xs" className="text-[#52525B] hover:text-[#A1A1AA]" onClick={clearFilters}>
                <X className="w-3 h-3 mr-1" />Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-[#1a1a1a]" />)}
            </div>
          ) : filteredRecords.length > 0 ? (
            <div className="p-4">
              <DataTable
                columns={columns}
                data={filteredRecords}
                pageSize={25}
              />
            </div>
          ) : (
            <EmptyState icon={FileText} title="No posting records" description="Posting history will appear here after runs complete" />
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="bg-[#111111] border-[#1a1a1a] text-[#FAFAFA] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Post Details</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-3 text-sm">
              {[
                ['Username', selectedRecord.username || selectedRecord.accountName],
                ['Identity', selectedRecord.identity],
                ['Status', null],
                ['Reel', selectedRecord.driveFilename || selectedRecord.baseVideo || selectedRecord.reelTitle],
                ['Date', selectedRecord.date || selectedRecord.postedAt ? new Date(selectedRecord.date || selectedRecord.postedAt).toLocaleString() : null],
                ['Duration', formatDuration(selectedRecord.duration)],
                ['Device', selectedRecord.device || selectedRecord.deviceName],
                ['Error', selectedRecord.error || selectedRecord.failureReason],
              ].filter(([, v]) => v !== undefined).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-[#1a1a1a] last:border-0">
                  <span className="text-[#52525B]">{label}</span>
                  {label === 'Status' ? <StatusBadge status={selectedRecord.status} /> : (
                    <span className={`text-[#A1A1AA] ${label === 'Error' ? 'text-[#EF4444]' : ''}`}>{value || '—'}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
