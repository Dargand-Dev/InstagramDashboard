import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import TimeAgo from '@/components/shared/TimeAgo'
import { AlertTriangle, Box, Loader2, Plus, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  backendColor,
  backendLabel,
  useDetectContainerBackend,
  useUpdateContainerBackend,
  useUpdateGhostPresets,
} from '@/hooks/useDeviceBackend'

const AUTO = '__AUTO__'

const OPTIONS = [
  { value: AUTO, label: 'Auto (détecté)' },
  { value: 'DORITOS', label: 'Doritos' },
  { value: 'CRANE_GHOST', label: 'Crane + Ghost' },
]

/**
 * Réglage de l'outillage de containers d'un téléphone, plus l'édition des presets Ghost dont
 * dépend la stack Crane.
 *
 * Deux notions distinctes cohabitent ici, et les confondre est la principale source d'erreur :
 * le **choix manuel** (`containerBackend`, éditable) et la **détection** (`detectedBackend`, en
 * lecture seule, écrite par la sonde). Le backend calcule `effectiveBackend` à partir des deux.
 */
export default function ContainerBackendCard({ device }) {
  const updateBackend = useUpdateContainerBackend()
  const detect = useDetectContainerBackend()

  const effective = device.effectiveBackend
  const isCrane = effective === 'CRANE_GHOST'

  const onChange = (value) => {
    const backend = value === AUTO ? null : value
    updateBackend.mutate(
      { id: device.id, backend },
      {
        onSuccess: () => toast.success(
          backend ? `Outillage forcé sur ${backendLabel(backend)}` : 'Outillage remis en automatique',
        ),
        onError: (e) => toast.error(e.message || 'Échec de la mise à jour'),
      },
    )
  }

  const onDetect = () => {
    detect.mutate(
      { id: device.id },
      {
        onSuccess: (res) => {
          if (res?.reachable) toast.success(res.message || 'Sonde terminée')
          else toast.warning(res?.message || 'Device injoignable')
        },
        onError: (e) => toast.error(e.message || 'Sonde impossible'),
      },
    )
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wide">
          Outillage containers
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10"
          onClick={onDetect}
          disabled={detect.isPending || !device.deviceIp}
          title={device.deviceIp ? 'Sonder le téléphone par SSH' : 'IP non configurée'}
        >
          {detect.isPending
            ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            : <RefreshCw className="w-3 h-3 mr-1" />}
          Re-détecter
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-[#52525B]">Réglage</Label>
          <Select
            value={device.containerBackend ?? AUTO}
            onValueChange={onChange}
            disabled={updateBackend.isPending}
          >
            <SelectTrigger className="h-9 bg-[#0A0A0A] border-[#1a1a1a] text-sm text-[#FAFAFA]">
              {/* Base UI (pas Radix) : sans enfant, SelectValue sérialise la valeur brute
                  et afficherait "CRANE_GHOST" au lieu de "Crane + Ghost". */}
              <SelectValue>
                {(value) => OPTIONS.find((o) => o.value === value)?.label || 'Auto (détecté)'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#111111] border-[#1a1a1a] text-[#FAFAFA]">
              {OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-[#52525B]">Appliqué</Label>
          <div
            className="min-h-9 px-3 py-2 rounded-md bg-[#111111] border border-[#1a1a1a] text-sm flex items-center gap-2"
            style={{ color: backendColor(effective) }}
          >
            <Box className="w-3.5 h-3.5 shrink-0" />
            {backendLabel(effective)}
          </div>
        </div>
      </div>

      <div className="text-xs text-[#52525B] space-y-0.5">
        {device.detectedBackend ? (
          <p>
            Détecté : <span style={{ color: backendColor(device.detectedBackend) }}>
              {backendLabel(device.detectedBackend)}
            </span>
            {device.backendDetectedAt && <> — <TimeAgo date={device.backendDetectedAt} /></>}
          </p>
        ) : (
          <p className="flex items-center gap-1 text-[#F59E0B]">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {device.backendDetectedAt
              ? "La sonde n'a pas pu trancher — les deux stacks sont peut-être installées."
              : 'Jamais sondé.'}
          </p>
        )}
        {device.backendProbe && (
          <p className="font-mono text-[10px] text-[#3f3f46]">{device.backendProbe}</p>
        )}
      </div>

      {isCrane && <GhostPresets device={device} />}
    </div>
  )
}

/**
 * Presets Ghost du device — la liste dans laquelle la création de container pioche pour usurper
 * un modèle d'appareil. Affichée seulement en Crane+Ghost : doritos gère le spoof lui-même.
 *
 * Un device Crane sans preset ne peut rien créer d'utilisable, d'où l'avertissement explicite
 * plutôt qu'une liste vide muette.
 */
function GhostPresets({ device }) {
  const update = useUpdateGhostPresets()
  const [draft, setDraft] = useState(null)

  const saved = device.presets || []
  const presets = draft ?? saved
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved)

  const setPreset = (index, key) => (e) => {
    const next = presets.map((p, i) => (i === index ? { ...p, [key]: e.target.value } : p))
    setDraft(next)
  }

  const addPreset = () => setDraft([...presets, { name: '', id: '' }])
  const removePreset = (index) => setDraft(presets.filter((_, i) => i !== index))

  const save = () => {
    const cleaned = presets
      .map((p) => ({ name: (p.name || '').trim(), id: (p.id || '').trim() }))
      .filter((p) => p.name && p.id)

    update.mutate(
      { id: device.id, presets: cleaned },
      {
        onSuccess: () => {
          setDraft(null)
          toast.success(`${cleaned.length} preset(s) enregistré(s)`)
        },
        onError: (e) => toast.error(e.message || "Échec de l'enregistrement"),
      },
    )
  }

  return (
    <div className="space-y-2 pt-3 border-t border-[#1a1a1a]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wide">Presets Ghost</p>
        <div className="flex gap-1">
          {dirty && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDraft(null)}>
              Annuler
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10"
            onClick={addPreset}
          >
            <Plus className="w-3 h-3 mr-1" /> Ajouter
          </Button>
          <Button size="sm" className="h-7 text-xs" disabled={!dirty || update.isPending} onClick={save}>
            {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      {presets.length === 0 ? (
        <div className="p-3 rounded-md bg-[#F59E0B]/5 border border-[#F59E0B]/10 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
          <p className="text-xs text-[#A1A1AA]">
            Aucun preset : la création de container échouera sur ce téléphone. Ajoute au moins un
            couple nom / id issu de <span className="font-mono text-[#FAFAFA]">ghost-cli</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {presets.map((preset, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="Nom (ex. 16promax)"
                value={preset.name || ''}
                onChange={setPreset(i, 'name')}
                className="h-9 bg-[#0A0A0A] border-[#1a1a1a] text-sm text-[#FAFAFA]"
              />
              <Input
                placeholder="UUID du preset"
                value={preset.id || ''}
                onChange={setPreset(i, 'id')}
                className="h-9 bg-[#0A0A0A] border-[#1a1a1a] text-sm text-[#FAFAFA] font-mono"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0 text-[#52525B] hover:text-[#EF4444]"
                onClick={() => removePreset(i)}
                title="Retirer"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
