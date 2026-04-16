import { useState, useMemo } from 'react'
import {
  SlidersHorizontal, X, Plus, Clock, Calendar, TrendingDown, TrendingUp,
  Ban, Link, ChevronDown, ChevronUp, Table2, Smartphone, CalendarOff, ExternalLink,
  Target, CalendarClock, CheckCircle2, CalendarRange,
} from 'lucide-react'
import DataTable from '@/components/shared/DataTable'
import StatusBadge from '@/components/shared/StatusBadge'
import { Blur } from '@/contexts/IncognitoContext'
import {
  FILTER_FIELDS, FILTER_PRESETS, applyFilters, formatFilterLabel, nextFilterId,
} from './tableFilters'

// ── Icon map for presets ───────────────────────────────────────────

const PRESET_ICONS = {
  Clock, Calendar, TrendingDown, TrendingUp, Ban, Link, SmartphoneOff: Smartphone, CalendarOff,
  Target, CalendarClock, CheckCircle2, CalendarRange,
}

// ── Relative time formatter ────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '---'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

// ── Value Input Component ──────────────────────────────────────────

const inputCls = 'bg-[#111] border border-[#1a1a1a] rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#333] w-full'
const selectCls = 'bg-[#111] border border-[#1a1a1a] rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#333] appearance-none cursor-pointer'

function FilterValueInput({ fieldDef, operator, value, onChange, identityNames, deviceNames }) {
  if (operator === 'empty') return null

  if (fieldDef.type === 'boolean') {
    return (
      <select value={String(value ?? '')} onChange={e => onChange(e.target.value === 'true')} className={selectCls}>
        <option value="">Select...</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  }

  if (fieldDef.type === 'enum') {
    return (
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} className={selectCls}>
        <option value="">Select...</option>
        {fieldDef.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  if (fieldDef.type === 'enum_dynamic') {
    const options = fieldDef.key === 'identity' ? identityNames : deviceNames
    return (
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} className={selectCls}>
        <option value="">Select...</option>
        {(options || []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  if (fieldDef.type === 'number' && operator === 'between') {
    const [min, max] = Array.isArray(value) ? value : ['', '']
    const coerce = v => v === '' ? '' : Number(v)
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          placeholder="Min"
          value={min}
          onChange={e => onChange([coerce(e.target.value), max])}
          className={`${inputCls} w-20`}
        />
        <span className="text-[#555] text-xs">–</span>
        <input
          type="number"
          placeholder="Max"
          value={max}
          onChange={e => onChange([min, coerce(e.target.value)])}
          className={`${inputCls} w-20`}
        />
      </div>
    )
  }

  if (fieldDef.type === 'number') {
    return (
      <input
        type="number"
        placeholder="Value"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className={`${inputCls} w-28`}
      />
    )
  }

  if (
    fieldDef.type === 'date' &&
    (operator === 'last_hours' ||
      operator === 'last_days' ||
      operator === 'days_ago_gte' ||
      operator === 'days_ago_lte')
  ) {
    return (
      <input
        type="number"
        placeholder={operator === 'last_hours' ? 'Hours' : 'Days'}
        value={value ?? ''}
        min={1}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className={`${inputCls} w-24`}
      />
    )
  }

  if (fieldDef.type === 'date') {
    return (
      <input
        type="date"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className={`${inputCls} w-40 [color-scheme:dark]`}
      />
    )
  }

  // text
  return (
    <input
      type="text"
      placeholder="Value"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className={`${inputCls} w-36`}
    />
  )
}

// ── Filter Row ─────────────────────────────────────────────────────

function FilterRow({ filter, onChange, onRemove, identityNames, deviceNames }) {
  const fieldDef = FILTER_FIELDS.find(f => f.key === filter.field)
  const operators = fieldDef?.operators || []

  function updateField(newField) {
    const newDef = FILTER_FIELDS.find(f => f.key === newField)
    const firstOp = newDef?.operators[0]?.value || ''
    onChange({ ...filter, field: newField, operator: firstOp, value: '' })
  }

  return (
    <div className="flex items-center gap-2 group">
      {/* Field select */}
      <select
        value={filter.field}
        onChange={e => updateField(e.target.value)}
        className={`${selectCls} min-w-[130px]`}
      >
        <option value="">Field...</option>
        {FILTER_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>

      {/* Operator select */}
      <select
        value={filter.operator}
        onChange={e => onChange({ ...filter, operator: e.target.value, value: '' })}
        className={`${selectCls} min-w-[120px]`}
      >
        {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>

      {/* Value input */}
      {fieldDef && (
        <FilterValueInput
          fieldDef={fieldDef}
          operator={filter.operator}
          value={filter.value}
          onChange={v => onChange({ ...filter, value: v })}
          identityNames={identityNames}
          deviceNames={deviceNames}
        />
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="p-1.5 rounded-md text-[#555] hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
        title="Remove filter"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────

export default function AccountsTableView({
  accounts,
  loading,
  postCounts,
  usernameToIdentity,
  accountDeviceMap,
  identityNames,
  deviceNames,
  onSelectAccount,
}) {
  const [filters, setFilters] = useState([])
  const [panelOpen, setPanelOpen] = useState(false)

  // Apply all filters (AND logic)
  const enrichment = useMemo(() => ({
    postCounts: postCounts || {},
    usernameToIdentity: usernameToIdentity || {},
    accountDeviceMap: accountDeviceMap || {},
  }), [postCounts, usernameToIdentity, accountDeviceMap])

  const filteredData = useMemo(
    () => applyFilters(accounts || [], filters, enrichment),
    [accounts, filters, enrichment],
  )

  // Filter mutations
  function addFilter() {
    const first = FILTER_FIELDS[0]
    setFilters(prev => [...prev, {
      id: nextFilterId(),
      field: first.key,
      operator: first.operators[0].value,
      value: '',
    }])
    setPanelOpen(true)
  }

  function updateFilter(id, updated) {
    setFilters(prev => prev.map(f => f.id === id ? updated : f))
  }

  function removeFilter(id) {
    setFilters(prev => prev.filter(f => f.id !== id))
  }

  function clearAll() {
    setFilters([])
    setPanelOpen(false)
  }

  function matchesPresetFilter(filter, pf) {
    return filter.field === pf.field && filter.operator === pf.operator && filter.value === pf.value
  }

  function isPresetActive(preset) {
    return preset.filters.every(pf =>
      filters.some(f => matchesPresetFilter(f, pf))
    )
  }

  function applyPreset(preset) {
    if (isPresetActive(preset)) {
      // Remove this preset's filters from the active list
      setFilters(prev => prev.filter(f =>
        !preset.filters.some(pf => matchesPresetFilter(f, pf))
      ))
    } else {
      // Add this preset's filters (avoid duplicates)
      setFilters(prev => {
        const toAdd = preset.filters.filter(pf =>
          !prev.some(f => matchesPresetFilter(f, pf))
        )
        return [...prev, ...toAdd.map(f => ({ ...f, id: nextFilterId() }))]
      })
    }
    setPanelOpen(false)
  }

  // Table columns
  const columns = useMemo(() => [
    {
      accessorKey: 'username',
      header: 'Username',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSelectAccount(row.original.id)}
            className="text-white font-medium hover:text-blue-400 transition-colors text-left truncate"
          >
            <Blur>{row.original.username}</Blur>
          </button>
          {row.original.username && (
            <button
              onClick={() => { window.open(`https://instagram.com/${row.original.username}`, '_blank', 'noopener'); window.focus() }}
              className="flex-shrink-0 text-[#333] hover:text-white transition-colors"
              title={`Open @${row.original.username} on Instagram`}
            >
              <ExternalLink size={13} />
            </button>
          )}
        </div>
      ),
      size: 140,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      size: 100,
    },
    {
      id: 'identity',
      header: 'Identity',
      accessorFn: row => usernameToIdentity[row.username] || '',
      cell: ({ row }) => {
        const name = usernameToIdentity[row.original.username]
        return name
          ? <span className="text-[#A1A1AA]"><Blur>{name}</Blur></span>
          : <span className="text-[#333]">---</span>
      },
      size: 120,
    },
    {
      id: 'device',
      header: 'Device',
      accessorFn: row => accountDeviceMap[row.id] || '',
      cell: ({ row }) => {
        const name = accountDeviceMap[row.original.id]
        return name
          ? <span className="text-[#A1A1AA]">{name}</span>
          : <span className="text-[#333]">---</span>
      },
      size: 120,
    },
    {
      accessorKey: 'viewsLast30Days',
      header: 'Views (30d)',
      cell: ({ row }) => (
        <span className="tabular-nums text-white">
          {(row.original.viewsLast30Days ?? 0).toLocaleString()}
        </span>
      ),
      size: 100,
    },
    {
      accessorKey: 'followerCount',
      header: 'Followers',
      cell: ({ row }) => (
        <span className="tabular-nums text-white">
          {(row.original.followerCount ?? 0).toLocaleString()}
        </span>
      ),
      size: 100,
    },
    {
      id: 'postCount',
      header: 'Posts',
      accessorFn: row => postCounts[row.username] || row.postCount || 0,
      cell: ({ row }) => (
        <span className="tabular-nums text-white">
          {(postCounts[row.original.username] || row.original.postCount || 0).toLocaleString()}
        </span>
      ),
      size: 80,
    },
    {
      accessorKey: 'schedulingEnabled',
      header: 'Sched',
      cell: ({ row }) =>
        row.original.schedulingEnabled
          ? <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20 font-semibold uppercase tracking-wide">ON</span>
          : <span className="text-[10px] bg-[#141414] text-[#555] px-2 py-0.5 rounded-md border border-[#1a1a1a] font-semibold uppercase tracking-wide">OFF</span>,
      size: 70,
    },
    {
      id: 'link',
      header: 'Link',
      accessorFn: row => row.storyLinkUrl ? 1 : 0,
      cell: ({ row }) => {
        const link = row.original.storyLinkUrl
        const status = row.original.necessaryLink
        if (!link) return <span className="text-[#333]">---</span>
        const colors = status === 'LINK_ACTIVE'
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : status === 'LINK_REQUIRED'
            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        const label = status === 'LINK_ACTIVE' ? 'Active' : status === 'LINK_REQUIRED' ? 'Required' : 'Pending'
        return <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md border ${colors}`}>{label}</span>
      },
      size: 80,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => <span className="text-[#A1A1AA] text-xs">{timeAgo(row.original.createdAt)}</span>,
      size: 90,
    },
    {
      accessorKey: 'lastLoginAt',
      header: 'Last Login',
      cell: ({ row }) => <span className="text-[#A1A1AA] text-xs">{timeAgo(row.original.lastLoginAt)}</span>,
      size: 90,
    },
  ], [postCounts, usernameToIdentity, accountDeviceMap, onSelectAccount])

  const hasFilters = filters.length > 0

  return (
    <div className="space-y-3" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Toolbar: presets + filter toggle ─────────────────────── */}
      <div className="flex flex-col gap-2.5">

        {/* Top row: presets + actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset chips */}
          {FILTER_PRESETS.map(preset => {
            const Icon = PRESET_ICONS[preset.icon] || SlidersHorizontal
            const active = isPresetActive(preset)
            return (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                  active
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                    : 'bg-[#0a0a0a] text-[#555] border-[#1a1a1a] hover:text-white hover:border-[#333]'
                }`}
              >
                <Icon size={12} />
                {preset.label}
              </button>
            )
          })}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Filter builder toggle */}
          <button
            onClick={() => panelOpen ? setPanelOpen(false) : addFilter()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              panelOpen
                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                : 'bg-[#0a0a0a] text-[#555] border-[#1a1a1a] hover:text-white hover:border-[#333]'
            }`}
          >
            <SlidersHorizontal size={13} />
            Filters
            {hasFilters && (
              <span className="ml-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {filters.length}
              </span>
            )}
            {panelOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Clear all */}
          {hasFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-[#555] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <X size={12} />
              Clear all
            </button>
          )}
        </div>

        {/* ── Filter builder panel (collapsible) ──────────────── */}
        {panelOpen && (
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#555] uppercase tracking-wider">Filter conditions</span>
              <span className="text-[10px] text-[#333]">All conditions must match (AND)</span>
            </div>

            {filters.map(f => (
              <FilterRow
                key={f.id}
                filter={f}
                onChange={updated => updateFilter(f.id, updated)}
                onRemove={() => removeFilter(f.id)}
                identityNames={identityNames}
                deviceNames={deviceNames}
              />
            ))}

            <button
              onClick={addFilter}
              className="flex items-center gap-1.5 text-xs text-[#555] hover:text-blue-400 transition-colors mt-1"
            >
              <Plus size={13} />
              Add condition
            </button>
          </div>
        )}

        {/* ── Active filter tags (when panel is closed) ───────── */}
        {!panelOpen && hasFilters && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-[#333] uppercase tracking-wider mr-1">Active:</span>
            {filters.map(f => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 text-[11px] font-medium px-2 py-0.5 rounded-md border border-blue-500/20"
              >
                {formatFilterLabel(f)}
                <button
                  onClick={() => removeFilter(f.id)}
                  className="hover:text-red-400 transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Summary bar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Table2 size={14} className="text-[#555]" />
          <span className="text-sm text-white font-semibold">
            {filteredData.length}
            <span className="text-[#555] font-normal">
              {hasFilters ? ` / ${(accounts || []).length} accounts` : ' accounts'}
            </span>
          </span>
        </div>
      </div>

      {/* ── Data Table ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          searchable
          searchPlaceholder="Quick search across all columns..."
          pageSize={50}
        />
      </div>
    </div>
  )
}
