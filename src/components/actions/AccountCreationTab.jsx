import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Loader2, CheckCircle, XCircle, ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiPost } from '@/hooks/useApi'
import { saveWorkflowRun } from '@/utils/workflow'

export default function AccountCreationTab({ devices }) {
  const navigate = useNavigate()
  const [device, setDevice] = useState('')
  const [identity, setIdentity] = useState('sofia')
  const [containers, setContainers] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (devices?.length > 0 && !device) {
      setDevice(devices[0].udid)
    }
  }, [devices, device])

  const parsedContainers = containers
    .split(/[,\n]+/)
    .map(s => s.trim())
    .filter(Boolean)

  async function handleCreate() {
    if (parsedContainers.length === 0) return
    setLoading(true)
    setResult(null)
    try {
      const data = await apiPost('/api/automation/workflow/create-account-existing', {
        deviceUdid: device,
        identityId: identity || undefined,
        containerNames: parsedContainers,
      })
      if (data.runId) saveWorkflowRun(data.runId, 'CreateAccountFromExistingContainer')
      setResult({ type: 'success', message: `Batch workflow accepted for ${parsedContainers.length} container(s)`, runId: data.runId })
      setContainers('')
    } catch (err) {
      setResult({ type: 'error', message: err.message })
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-lg mx-auto py-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 mb-3">
          <Layers size={24} />
        </div>
        <h2 className="text-lg font-bold text-foreground">Create Accounts</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Switch Container &rarr; Register &rarr; Professional Setup &rarr; 2FA
        </p>
      </div>

      <div className="space-y-4">
        {/* Device */}
        <div>
          <label className="block text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">
            Device
          </label>
          <Select value={device} onValueChange={setDevice}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Select device" />
            </SelectTrigger>
            <SelectContent>
              {(devices || []).map(d => (
                <SelectItem key={d.udid} value={d.udid} className="text-xs">
                  {d.name} — ...{d.udid.slice(-8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Identity */}
        <div>
          <label className="block text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">
            Identity ID
          </label>
          <Input
            value={identity}
            onChange={e => setIdentity(e.target.value)}
            placeholder="sofia"
            className="text-xs"
          />
        </div>

        {/* Containers */}
        <div>
          <label className="block text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">
            Container Names
          </label>
          <Textarea
            value={containers}
            onChange={e => setContainers(e.target.value)}
            placeholder={'5, 8, 12\nor one per line'}
            rows={3}
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Comma or newline separated list of existing Crane container names.</p>
        </div>

        {/* Chips preview */}
        {parsedContainers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {parsedContainers.map((name, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] font-mono gap-1 pr-1">
                {name}
                <button
                  onClick={() => {
                    const remaining = parsedContainers.filter((_, j) => j !== i)
                    setContainers(remaining.join(', '))
                  }}
                  className="ml-0.5 hover:text-foreground text-muted-foreground"
                >
                  <X size={10} />
                </button>
              </Badge>
            ))}
            <span className="text-[10px] text-muted-foreground self-center ml-1">
              {parsedContainers.length} container{parsedContainers.length > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Submit */}
        <Button
          onClick={handleCreate}
          disabled={loading || parsedContainers.length === 0}
          className="w-full"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
          {loading ? 'Creating...' : 'Create Accounts'}
        </Button>

        {/* Result */}
        {result && (
          <div className={`flex items-center justify-between p-3 rounded-md border text-xs font-medium ${
            result.type === 'error'
              ? 'bg-destructive/5 text-destructive border-destructive/15'
              : 'bg-emerald-500/5 text-emerald-400 border-emerald-500/15'
          }`}>
            <div className="flex items-center gap-2">
              {result.type === 'error' ? <XCircle size={14} /> : <CheckCircle size={14} />}
              {result.message}
            </div>
            {result.runId && (
              <button
                onClick={() => navigate('/activity?tab=logs')}
                className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors font-semibold"
              >
                View logs <ExternalLink size={10} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
