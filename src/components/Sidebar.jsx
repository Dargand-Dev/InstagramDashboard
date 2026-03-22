import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, History, Clock, Zap, Film, BookOpen, Trash2 } from 'lucide-react'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts', icon: Users, label: 'Accounts' },
  { to: '/runs', icon: History, label: 'Runs' },
  { to: '/scheduler', icon: Clock, label: 'Scheduler' },
  { to: '/actions', icon: Zap, label: 'Actions' },
  { to: '/content', icon: Film, label: 'Content' },
  { to: '/posting-history', icon: BookOpen, label: 'Posting History' },
  { to: '/drive-trash', icon: Trash2, label: 'Drive Trash' },
]

export default function Sidebar() {
  return (
    <aside className="w-60 bg-surface-alt border-r border-border flex flex-col shrink-0">
      <div className="p-6">
        <h1 className="text-lg font-bold text-white tracking-tight">IG Automation</h1>
        <p className="text-xs text-text-muted mt-1">Monitoring Dashboard</p>
      </div>
      <nav className="flex-1 px-3">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 ${
                isActive
                  ? 'bg-primary-dim text-primary'
                  : 'text-text-muted hover:text-text hover:bg-surface-hover'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <p className="text-xs text-text-muted">Backend: localhost:8081</p>
      </div>
    </aside>
  )
}
