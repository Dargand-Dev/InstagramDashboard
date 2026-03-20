export default function Card({ title, children, className = '', icon: Icon }) {
  return (
    <div className={`bg-surface-card backdrop-blur-sm border border-border rounded-2xl p-6 transition-colors hover:bg-surface-hover ${className}`}>
      {title && (
        <div className="flex items-center gap-2 mb-4">
          {Icon && <Icon size={18} className="text-text-muted" />}
          <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">{title}</h3>
        </div>
      )}
      {children}
    </div>
  )
}
