import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, BarChart3, Users, Zap, Activity, BookOpen, Send, UserPlus, ListOrdered, Menu } from 'lucide-react'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/accounts', icon: Users, label: 'Accounts' },
  { to: '/actions', icon: Zap, label: 'Actions' },
  { to: '/activity', icon: Activity, label: 'Activity' },
  { to: '/queue', icon: ListOrdered, label: 'File d\'attente' },
  { to: '/posting-runs', icon: Send, label: 'Posting Runs' },
  { to: '/creation-runs', icon: UserPlus, label: 'Creation Runs' },
  { to: '/posting-history', icon: BookOpen, label: 'Posting History' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sidebar-collapsed')) ?? false }
    catch { return false }
  })

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(collapsed))
  }, [collapsed])

  return (
    <aside
      className="flex flex-col shrink-0 bg-[#0a0a0a] border-r border-[#1a1a1a] transition-all duration-200"
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Header */}
      <div className="flex items-center h-16 px-4 border-b border-[#1a1a1a]">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-2 rounded-md text-[#555] hover:text-white hover:bg-[#111] transition-colors"
        >
          <Menu size={20} />
        </button>
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <span className="text-base font-extrabold text-white tracking-tight whitespace-nowrap">IG AUTO</span>
            <p className="text-xs text-[#333] font-medium whitespace-nowrap">Monitoring</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `group relative flex items-center rounded-lg mb-1 transition-colors ${
                collapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'
              } ${
                isActive
                  ? 'text-white bg-white/[0.06]'
                  : 'text-[#555] hover:text-[#999] hover:bg-white/[0.03]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-primary rounded-r" />
                )}
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                {!collapsed && (
                  <span className="text-sm font-semibold whitespace-nowrap">{label}</span>
                )}
                {/* Tooltip in collapsed mode */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#1a1a1a] text-white text-sm font-medium rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    {label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom status */}
      <div className="px-4 pb-4">
        <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-2 h-2 rounded-full bg-success" />
          {!collapsed && <span className="text-xs text-[#333] font-medium">Backend connected</span>}
        </div>
      </div>
    </aside>
  )
}
