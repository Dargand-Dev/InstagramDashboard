import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Skeleton } from '@/components/ui/skeleton'
import { useState, useEffect } from 'react'

export default function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const checkAuth = useAuthStore((s) => s.checkAuth)
  const [checking, setChecking] = useState(true)
  const location = useLocation()

  useEffect(() => {
    checkAuth()
    setChecking(false)
  }, [checkAuth])

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] p-8 space-y-4">
        <Skeleton className="h-8 w-64 bg-[#1a1a1a]" />
        <Skeleton className="h-64 w-full bg-[#1a1a1a]" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
