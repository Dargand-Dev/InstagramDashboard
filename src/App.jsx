import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { IncognitoProvider } from '@/contexts/IncognitoContext'
import { queryClient } from '@/lib/queryClient'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import PageSkeleton from '@/components/shared/PageSkeleton'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'

const ExecutionCenter = lazy(() => import('@/pages/ExecutionCenter'))
const Queue = lazy(() => import('@/pages/Queue'))
const Actions = lazy(() => import('@/pages/Actions'))
const Devices = lazy(() => import('@/pages/Devices'))
const Accounts = lazy(() => import('@/pages/Accounts'))
const ErrorCenter = lazy(() => import('@/pages/ErrorCenter'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const ActivityLog = lazy(() => import('@/pages/ActivityLog'))
const Analytics = lazy(() => import('@/pages/Analytics'))
const PostingHistory = lazy(() => import('@/pages/PostingHistory'))
const Schedule = lazy(() => import('@/pages/Schedule'))
const Settings = lazy(() => import('@/pages/Settings'))
const NotFound = lazy(() => import('@/pages/NotFound'))

function LazyPage({ children }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <IncognitoProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/execution-center" element={<LazyPage><ExecutionCenter /></LazyPage>} />
                <Route path="/queue" element={<LazyPage><Queue /></LazyPage>} />
                <Route path="/actions" element={<LazyPage><Actions /></LazyPage>} />
                <Route path="/devices" element={<LazyPage><Devices /></LazyPage>} />
                <Route path="/accounts" element={<LazyPage><Accounts /></LazyPage>} />
                <Route path="/error-center" element={<LazyPage><ErrorCenter /></LazyPage>} />
                <Route path="/notifications" element={<LazyPage><Notifications /></LazyPage>} />
                <Route path="/activity-log" element={<LazyPage><ActivityLog /></LazyPage>} />
                <Route path="/analytics" element={<LazyPage><Analytics /></LazyPage>} />
                <Route path="/posting-history" element={<LazyPage><PostingHistory /></LazyPage>} />
                <Route path="/schedule" element={<LazyPage><Schedule /></LazyPage>} />
                <Route path="/settings" element={<LazyPage><Settings /></LazyPage>} />
                <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
              </Route>
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
        </IncognitoProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#111111',
              border: '1px solid #1a1a1a',
              color: '#FAFAFA',
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
