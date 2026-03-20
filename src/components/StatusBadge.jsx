const statusStyles = {
  ACTIVE: 'bg-success-dim text-success',
  SUSPENDED: 'bg-warning-dim text-warning',
  BANNED: 'bg-error-dim text-error',
  ERROR: 'bg-surface-alt text-text-muted',
  SUCCESS: 'bg-success-dim text-success',
  FAILED: 'bg-error-dim text-error',
  RUNNING: 'bg-primary-dim text-primary',
  ENABLED: 'bg-success-dim text-success',
  DISABLED: 'bg-surface-alt text-text-muted',
  CLEAN: 'bg-success-dim text-success',
  PENDING: 'bg-warning-dim text-warning',
  LOW_STOCK: 'bg-warning-dim text-warning',
  EMPTY: 'bg-error-dim text-error',
  OK: 'bg-success-dim text-success',
}

export default function StatusBadge({ status }) {
  const style = statusStyles[status] || 'bg-surface-alt text-text-muted'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {status}
    </span>
  )
}
