import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { IncognitoProvider } from './contexts/IncognitoContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Actions from './pages/Actions'
import Activity from './pages/Activity'
import PostingHistory from './pages/PostingHistory'
import PostingRuns from './pages/PostingRuns'
import CreationRuns from './pages/CreationRuns'
import Analytics from './pages/Analytics'
import Queue from './pages/Queue'

export default function App() {
  return (
    <IncognitoProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/actions" element={<Actions />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/posting-runs" element={<PostingRuns />} />
            <Route path="/creation-runs" element={<CreationRuns />} />
            <Route path="/posting-history" element={<PostingHistory />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </IncognitoProvider>
  )
}
