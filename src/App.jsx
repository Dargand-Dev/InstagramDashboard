import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Actions from './pages/Actions'
import Activity from './pages/Activity'
import PostingHistory from './pages/PostingHistory'
import Analytics from './pages/Analytics'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/actions" element={<Actions />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/posting-history" element={<PostingHistory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
