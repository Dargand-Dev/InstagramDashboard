import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Runs from './pages/Runs'
import Scheduler from './pages/Scheduler'
import Content from './pages/Content'
import DriveTrash from './pages/DriveTrash'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/scheduler" element={<Scheduler />} />
          <Route path="/content" element={<Content />} />
          <Route path="/drive-trash" element={<DriveTrash />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
