import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from '@/lib/queryClient'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import ExecutionCenter from '@/pages/ExecutionCenter'
import Queue from '@/pages/Queue'
import Actions from '@/pages/Actions'
import Devices from '@/pages/Devices'
import Accounts from '@/pages/Accounts'
import ErrorCenter from '@/pages/ErrorCenter'
import Notifications from '@/pages/Notifications'
import ActivityLog from '@/pages/ActivityLog'
import Analytics from '@/pages/Analytics'
import PostingHistory from '@/pages/PostingHistory'
import Schedule from '@/pages/Schedule'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <BrowserRouter>
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
              <Route path="/execution-center" element={<ExecutionCenter />} />
              <Route path="/queue" element={<Queue />} />
              <Route path="/actions" element={<Actions />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/error-center" element={<ErrorCenter />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/activity-log" element={<ActivityLog />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/posting-history" element={<PostingHistory />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
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
