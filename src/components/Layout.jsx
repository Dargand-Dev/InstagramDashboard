import { Outlet } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import Sidebar from './Sidebar'
import { useIncognito } from '../contexts/IncognitoContext'

export default function Layout() {
  const { isIncognito, toggleIncognito } = useIncognito()

  return (
    <div className="flex h-screen overflow-hidden bg-black">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 relative">
        <button
          onClick={toggleIncognito}
          className="fixed top-4 right-4 z-50 p-2 rounded-md transition-colors"
          style={{ color: isIncognito ? '#fff' : '#555' }}
          title={isIncognito ? 'Disable incognito mode' : 'Enable incognito mode'}
        >
          {isIncognito ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
        <Outlet />
      </main>
    </div>
  )
}
