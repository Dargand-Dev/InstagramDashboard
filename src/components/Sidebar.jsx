import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Zap, Activity, Menu } from 'lucide-react'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts', icon: Users, label: 'Accounts' },
  { to: '/actions', icon: Zap, label: 'Actions' },
  { to: '/activity', icon: Activity, label: 'Activity' },
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
      style={{ width: collapsed ? 60 : 180 }}
    >
      {/* Header */}
      <div className="flex items-center h-14 px-3 border-b border-[#1a1a1a]">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-1.5 rounded-md text-[#555] hover:text-white hover:bg-[#111] transition-colors"
        >
          <Menu size={18} />
        </button>
        {!collapsed && (
          <div className="ml-2 overflow-hidden">
            <span className="text-sm font-extrabold text-white tracking-tight whitespace-nowrap">IG AUTO</span>
            <p className="text-[10px] text-[#333] font-medium whitespace-nowrap">Monitoring</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `group relative flex items-center rounded-md mb-0.5 transition-colors ${
                collapsed ? 'justify-center py-2.5' : 'gap-2.5 px-2.5 py-2'
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
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-primary rounded-r" />
                )}
                <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                {!collapsed && (
                  <span className="text-[13px] font-semibold whitespace-nowrap">{label}</span>
                )}
                {/* Tooltip in collapsed mode */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[#1a1a1a] text-white text-xs font-medium rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    {label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom status */}
      <div className="px-3 pb-3">
        <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-1.5 h-1.5 rounded-full bg-success" />
          {!collapsed && <span className="text-[10px] text-[#333] font-medium">Backend connected</span>}
        </div>
      </div>
    </aside>
  )
}
