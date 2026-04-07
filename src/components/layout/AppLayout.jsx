import { Outlet, useLocation, Link } from 'react-router-dom'
import { useState } from 'react'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
  LayoutDashboard,
  Zap,
  ListOrdered,
  Clapperboard,
  Smartphone,
  Users,
  AlertTriangle,
  Bell,
  ScrollText,
  TrendingUp,
  FileText,
  CalendarDays,
  Settings,
  ChevronLeft,
  Search,
  LogOut,
  Instagram,
  Menu,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import CommandPalette from '@/components/CommandPalette'

const NAV_SECTIONS = [
  {
    label: 'OVERVIEW',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { path: '/execution-center', label: 'Execution Center', icon: Zap },
      { path: '/queue', label: 'Queue', icon: ListOrdered },
      { path: '/actions', label: 'Actions', icon: Clapperboard },
      { path: '/auto-creation', label: 'Auto-Creation', icon: UserPlus },
    ],
  },
  {
    label: 'FLEET',
    items: [
      { path: '/devices', label: 'Devices', icon: Smartphone },
      { path: '/accounts', label: 'Accounts', icon: Users },
    ],
  },
  {
    label: 'MONITORING',
    items: [
      { path: '/error-center', label: 'Error Center', icon: AlertTriangle },
      { path: '/notifications', label: 'Notifications', icon: Bell, showBadge: true },
      { path: '/activity-log', label: 'Activity Log', icon: ScrollText },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { path: '/analytics', label: 'Growth & Stats', icon: TrendingUp },
      { path: '/posting-history', label: 'Posting History', icon: FileText },
      { path: '/schedule', label: 'Schedule', icon: CalendarDays },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { path: '/settings', label: 'Configuration', icon: Settings },
    ],
  },
]

function NavItem({ item, collapsed, isActive }) {
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const Icon = item.icon

  const content = (
    <Link
      to={item.path}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 relative group',
        isActive
          ? 'sidebar-item-active text-[#FAFAFA] font-medium'
          : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#111111]'
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.showBadge && unreadCount > 0 && (
            <Badge variant="destructive" className="ml-auto text-[10px] h-5 min-w-5 px-1.5 bg-[#EF4444]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </>
      )}
      {collapsed && item.showBadge && unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#EF4444] rounded-full" />
      )}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger render={<div />}>{content}</TooltipTrigger>
        <TooltipContent side="right" className="bg-[#1a1a1a] text-[#FAFAFA] border-[#1a1a1a]">
          {item.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return content
}

function SidebarContent({ collapsed, setCollapsed, wsStatus }) {
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 h-14 border-b border-[#1a1a1a] shrink-0', collapsed && 'justify-center px-2')}>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shrink-0">
          <Instagram className="w-3.5 h-3.5 text-white" />
        </div>
        {!collapsed && <span className="font-semibold text-sm text-[#FAFAFA] truncate">Instagram Automation</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="label-upper px-3 mb-1.5">{section.label}</p>
            )}
            {collapsed && <div className="h-px bg-[#1a1a1a] mx-2 mb-2" />}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem
                  key={item.path}
                  item={item}
                  collapsed={collapsed}
                  isActive={location.pathname === item.path}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={cn('border-t border-[#1a1a1a] p-3 shrink-0', collapsed && 'px-2')}>
        {/* WebSocket status */}
        <div className={cn('flex items-center gap-2 mb-2', collapsed && 'justify-center')}>
          <span className={cn(
            'w-2 h-2 rounded-full shrink-0',
            wsStatus === 'CONNECTED' ? 'bg-[#22C55E]' :
            wsStatus === 'CONNECTING' ? 'bg-[#F59E0B] animate-pulse' :
            'bg-[#EF4444]'
          )} />
          {!collapsed && (
            <span className="text-[10px] text-[#52525B]">
              {wsStatus === 'CONNECTED' ? 'Live' : wsStatus === 'CONNECTING' ? 'Connecting' : 'Offline'}
            </span>
          )}
        </div>
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 w-full rounded-lg p-1.5 hover:bg-[#111111] transition-colors duration-150 cursor-pointer border-0 bg-transparent">
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="bg-[#3B82F6] text-white text-xs">
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <span className="text-sm text-[#A1A1AA] truncate">{user?.username || 'User'}</span>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48 bg-[#111111] border-[#1a1a1a]">
              <DropdownMenuItem className="text-[#A1A1AA]" disabled>
                {user?.username || 'User'}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#1a1a1a]" />
              <DropdownMenuItem onClick={logout} className="text-[#EF4444] focus:text-[#EF4444]">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const { status: wsStatus } = useWebSocket()

  // Find current page info for breadcrumb
  const currentSection = NAV_SECTIONS.find((s) =>
    s.items.some((i) => i.path === location.pathname)
  )
  const currentPage = currentSection?.items.find((i) => i.path === location.pathname)

  return (
    <div className="flex h-screen bg-[#0A0A0A]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar - Desktop */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r border-[#1a1a1a] bg-[#0A0A0A] transition-all duration-200 shrink-0',
          collapsed ? 'w-[60px]' : 'w-[240px]'
        )}
      >
        <SidebarContent collapsed={collapsed} setCollapsed={setCollapsed} wsStatus={wsStatus} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-3.5 hidden lg:flex items-center justify-center w-5 h-5 rounded-full border border-[#1a1a1a] bg-[#0A0A0A] hover:bg-[#111111] transition-colors duration-150 z-10"
          style={{ left: collapsed ? 48 : 228 }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={cn('w-3 h-3 text-[#52525B] transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>
      </aside>

      {/* Sidebar - Mobile */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#1a1a1a] bg-[#0A0A0A] w-[240px] transition-transform duration-200 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent collapsed={false} setCollapsed={() => {}} wsStatus={wsStatus} />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-[#1a1a1a] flex items-center justify-between px-4 lg:px-6 shrink-0 bg-[#0A0A0A]">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-[#A1A1AA] hover:text-[#FAFAFA] h-8 w-8"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </Button>
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm">
              {currentSection && (
                <>
                  <span className="text-[#52525B]">{currentSection.label}</span>
                  <span className="text-[#52525B]">/</span>
                </>
              )}
              <span className="text-[#FAFAFA] font-medium">{currentPage?.label || 'Dashboard'}</span>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setCmdOpen(true)}
              className="hidden sm:flex items-center gap-2 h-8 px-3 text-[#52525B] hover:text-[#A1A1AA] bg-[#111111] border border-[#1a1a1a] rounded-lg text-xs"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search...</span>
              <kbd className="ml-2 text-[10px] bg-[#0A0A0A] px-1.5 py-0.5 rounded border border-[#1a1a1a]">⌘K</kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden h-8 w-8 text-[#A1A1AA]"
              onClick={() => setCmdOpen(true)}
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </Button>
            <Link to="/notifications">
              <Button variant="ghost" size="icon" className="relative h-8 w-8 text-[#A1A1AA] hover:text-[#FAFAFA]" aria-label="Notifications">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#EF4444] rounded-full text-[10px] text-white flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  )
}
