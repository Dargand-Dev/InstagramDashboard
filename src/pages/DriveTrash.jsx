import { Trash2 } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { useApi } from '../hooks/useApi'

export default function DriveTrash() {
  const { data: trashQueue, loading } = useApi('/api/automation/drive/trash-queue')

  const items = trashQueue
    ? Array.isArray(trashQueue) ? trashQueue : trashQueue.files || []
    : []

  return (
    <div>
      <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
        <Trash2 size={24} />
        Drive Trash Queue
      </h2>

      <div className="bg-surface-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-text-muted font-medium">File Name</th>
              <th className="px-4 py-3 text-text-muted font-medium">Identity</th>
              <th className="px-4 py-3 text-text-muted font-medium">Status</th>
              <th className="px-4 py-3 text-text-muted font-medium">Queued At</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text-muted">No files in trash queue</td></tr>
            ) : (
              items.map((file, i) => (
                <tr key={i} className="border-b border-border hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{file.fileName || file.name || '—'}</td>
                  <td className="px-4 py-3 text-text-muted">{file.identity || file.identityName || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={file.status || 'PENDING'} /></td>
                  <td className="px-4 py-3 text-text-muted">
                    {file.queuedAt || file.createdAt ? new Date(file.queuedAt || file.createdAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
