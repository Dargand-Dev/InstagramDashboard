// Pure filter logic for the Accounts table view.
// No React dependencies — just data definitions and evaluation functions.

export function nextFilterId() {
  return crypto.randomUUID()
}

// ── Field Definitions ──────────────────────────────────────────────

export const FILTER_FIELDS = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    options: ['ACTIVE', 'SUSPENDED', 'BANNED', 'ERROR'],
    operators: [
      { value: 'eq', label: 'is' },
      { value: 'neq', label: 'is not' },
    ],
  },
  {
    key: 'viewsLast30Days',
    label: 'Views (30d)',
    type: 'number',
    operators: [
      { value: 'gt', label: '>' },
      { value: 'lt', label: '<' },
      { value: 'eq', label: '=' },
      { value: 'between', label: 'between' },
    ],
  },
  {
    key: 'followerCount',
    label: 'Followers',
    type: 'number',
    operators: [
      { value: 'gt', label: '>' },
      { value: 'lt', label: '<' },
      { value: 'eq', label: '=' },
      { value: 'between', label: 'between' },
    ],
  },
  {
    key: 'postCount',
    label: 'Posts',
    type: 'number',
    operators: [
      { value: 'gt', label: '>' },
      { value: 'lt', label: '<' },
      { value: 'eq', label: '=' },
    ],
  },
  {
    key: 'createdAt',
    label: 'Created Date',
    type: 'date',
    operators: [
      { value: 'last_hours', label: 'in last N hours' },
      { value: 'last_days', label: 'in last N days' },
      { value: 'after', label: 'after' },
      { value: 'before', label: 'before' },
    ],
  },
  {
    key: 'lastLoginAt',
    label: 'Last Login',
    type: 'date',
    operators: [
      { value: 'last_hours', label: 'in last N hours' },
      { value: 'last_days', label: 'in last N days' },
      { value: 'after', label: 'after' },
      { value: 'before', label: 'before' },
    ],
  },
  {
    key: 'schedulingEnabled',
    label: 'Scheduling',
    type: 'boolean',
    operators: [{ value: 'eq', label: 'is' }],
  },
  {
    key: 'identity',
    label: 'Identity',
    type: 'enum_dynamic',
    operators: [
      { value: 'eq', label: 'is' },
      { value: 'neq', label: 'is not' },
      { value: 'empty', label: 'is empty' },
    ],
  },
  {
    key: 'device',
    label: 'Device',
    type: 'enum_dynamic',
    operators: [
      { value: 'eq', label: 'is' },
      { value: 'neq', label: 'is not' },
      { value: 'empty', label: 'is empty' },
    ],
  },
  {
    key: 'hasLink',
    label: 'Story Link',
    type: 'boolean',
    operators: [{ value: 'eq', label: 'is' }],
  },
  {
    key: 'username',
    label: 'Username',
    type: 'text',
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'eq', label: 'equals' },
    ],
  },
]

// ── Presets ─────────────────────────────────────────────────────────

export const FILTER_PRESETS = [
  {
    label: 'Created last 24h',
    icon: 'Clock',
    filters: [{ field: 'createdAt', operator: 'last_hours', value: 24 }],
  },
  {
    label: 'Created last 7 days',
    icon: 'Calendar',
    filters: [{ field: 'createdAt', operator: 'last_days', value: 7 }],
  },
  {
    label: 'Low views (< 10k)',
    icon: 'TrendingDown',
    filters: [{ field: 'viewsLast30Days', operator: 'lt', value: 10000 }],
  },
  {
    label: 'High performers (> 100k)',
    icon: 'TrendingUp',
    filters: [{ field: 'viewsLast30Days', operator: 'gt', value: 100000 }],
  },
  {
    label: '10k–100k views, no link',
    icon: 'Target',
    filters: [
      { field: 'viewsLast30Days', operator: 'between', value: [10000, 100000] },
      { field: 'hasLink', operator: 'eq', value: false },
    ],
  },
  {
    label: 'Created last 4 days',
    icon: 'CalendarClock',
    filters: [{ field: 'createdAt', operator: 'last_days', value: 4 }],
  },
  {
    label: 'No device',
    icon: 'SmartphoneOff',
    filters: [{ field: 'device', operator: 'empty', value: true }],
  },
  {
    label: 'Active',
    icon: 'CheckCircle2',
    filters: [{ field: 'status', operator: 'eq', value: 'ACTIVE' }],
  },
  {
    label: 'Banned',
    icon: 'Ban',
    filters: [{ field: 'status', operator: 'eq', value: 'BANNED' }],
  },
  {
    label: 'Scheduling OFF',
    icon: 'CalendarOff',
    filters: [{ field: 'schedulingEnabled', operator: 'eq', value: false }],
  },
  {
    label: 'Has story link',
    icon: 'Link',
    filters: [{ field: 'hasLink', operator: 'eq', value: true }],
  },
]

// ── Field Value Resolution ─────────────────────────────────────────

function getFieldValue(account, fieldKey, enrichment) {
  switch (fieldKey) {
    case 'postCount':
      return enrichment.postCounts[account.username] || account.postCount || 0
    case 'identity':
      return enrichment.usernameToIdentity[account.username] || ''
    case 'device':
      return enrichment.accountDeviceMap[account.id] || ''
    case 'hasLink':
      return !!account.storyLinkUrl
    case 'viewsLast30Days':
      return account.viewsLast30Days ?? 0
    case 'followerCount':
      return account.followerCount ?? 0
    default:
      return account[fieldKey]
  }
}

// ── Condition Evaluation ───────────────────────────────────────────

const MS_PER_HOUR = 3600000
const MS_PER_DAY = 86400000

function evaluateCondition(rawValue, operator, filterValue) {
  switch (operator) {
    // Numeric
    case 'gt': return Number(rawValue) > Number(filterValue)
    case 'lt': return Number(rawValue) < Number(filterValue)
    case 'eq': {
      // Boolean fields
      if (typeof filterValue === 'boolean') return rawValue === filterValue
      // Numeric or string equality
      if (typeof rawValue === 'number') return rawValue === Number(filterValue)
      return String(rawValue).toLowerCase() === String(filterValue).toLowerCase()
    }
    case 'neq':
      return String(rawValue).toLowerCase() !== String(filterValue).toLowerCase()
    case 'between': {
      const num = Number(rawValue)
      const [min, max] = Array.isArray(filterValue) ? filterValue : [0, 0]
      return num >= Number(min) && num <= Number(max)
    }

    // Text
    case 'contains':
      return String(rawValue).toLowerCase().includes(String(filterValue).toLowerCase())

    // Date — absolute
    case 'after': {
      if (!rawValue) return false
      return new Date(rawValue).getTime() > new Date(filterValue).getTime()
    }
    case 'before': {
      if (!rawValue) return false
      return new Date(rawValue).getTime() < new Date(filterValue).getTime()
    }

    // Date — relative
    case 'last_hours': {
      if (!rawValue) return false
      const cutoff = Date.now() - Number(filterValue) * MS_PER_HOUR
      return new Date(rawValue).getTime() >= cutoff
    }
    case 'last_days': {
      if (!rawValue) return false
      const cutoff = Date.now() - Number(filterValue) * MS_PER_DAY
      return new Date(rawValue).getTime() >= cutoff
    }

    // Empty check
    case 'empty':
      return !rawValue || rawValue === ''

    default:
      return true
  }
}

// ── Main Filter Function ───────────────────────────────────────────

export function applyFilters(accounts, filters, enrichment) {
  if (!filters.length) return accounts
  return accounts.filter(account =>
    filters.every(f => {
      const raw = getFieldValue(account, f.field, enrichment)
      return evaluateCondition(raw, f.operator, f.value)
    })
  )
}

// ── Human-Readable Label ───────────────────────────────────────────

export function formatFilterLabel(filter) {
  const field = FILTER_FIELDS.find(f => f.key === filter.field)
  const fieldLabel = field?.label || filter.field
  const op = field?.operators.find(o => o.value === filter.operator)
  const opLabel = op?.label || filter.operator

  if (filter.operator === 'empty') return `${fieldLabel} is empty`
  if (filter.operator === 'between' && Array.isArray(filter.value)) {
    return `${fieldLabel} ${Number(filter.value[0]).toLocaleString()}–${Number(filter.value[1]).toLocaleString()}`
  }
  if (filter.operator === 'last_hours') return `${fieldLabel} last ${filter.value}h`
  if (filter.operator === 'last_days') return `${fieldLabel} last ${filter.value}d`
  if (typeof filter.value === 'boolean') {
    return `${fieldLabel} ${filter.value ? 'Yes' : 'No'}`
  }

  const val = typeof filter.value === 'number'
    ? filter.value.toLocaleString()
    : filter.value

  return `${fieldLabel} ${opLabel} ${val}`
}
