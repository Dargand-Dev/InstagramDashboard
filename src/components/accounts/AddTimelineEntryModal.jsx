import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { LIFECYCLE_EVENT_TYPES } from '@/api/accountTimeline'

const MODE_NOTE = 'note'
const MODE_LIFECYCLE = 'lifecycle'

function localDatetimeToIso(value) {
  if (!value) return null
  // value is "YYYY-MM-DDTHH:mm" — interpret as local time and convert to ISO UTC.
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function nowAsLocalDatetime() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AddTimelineEntryModal({ open, onClose, onSubmitNote, onSubmitLifecycle }) {
  const [mode, setMode] = useState(MODE_NOTE)
  const [date, setDate] = useState(nowAsLocalDatetime())
  // Note libre
  const [text, setText] = useState('')
  const [tagsCsv, setTagsCsv] = useState('')
  // Lifecycle
  const [eventType, setEventType] = useState(LIFECYCLE_EVENT_TYPES[0].value)
  const [linkUrl, setLinkUrl] = useState('')
  const [lifecycleNote, setLifecycleNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Fermer la modal sur Escape (a11y clavier).
  useEffect(() => {
    if (!open) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const selectedLifecycleType = LIFECYCLE_EVENT_TYPES.find(t => t.value === eventType)
  const noteValid = mode === MODE_NOTE
    ? text.trim().length > 0 && text.length <= 5000
    : true
  const lifecycleValid = mode === MODE_LIFECYCLE
    ? (!selectedLifecycleType?.requiresLinkUrl || linkUrl.trim().length > 0)
      && lifecycleNote.length <= 500
      && linkUrl.length <= 2000
    : true
  const canSubmit = !submitting && noteValid && lifecycleValid

  function reset() {
    setMode(MODE_NOTE)
    setDate(nowAsLocalDatetime())
    setText('')
    setTagsCsv('')
    setEventType(LIFECYCLE_EVENT_TYPES[0].value)
    setLinkUrl('')
    setLifecycleNote('')
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      if (mode === MODE_NOTE) {
        const tags = tagsCsv.split(',').map(t => t.trim()).filter(Boolean)
        await onSubmitNote({
          noteAt: localDatetimeToIso(date),
          text: text.trim(),
          tags: tags.length ? tags : undefined,
        })
      } else {
        const attributes = {}
        if (linkUrl.trim()) attributes.linkUrl = linkUrl.trim()
        if (lifecycleNote.trim()) attributes.note = lifecycleNote.trim()
        await onSubmitLifecycle({
          eventType,
          ts: localDatetimeToIso(date),
          attributes: Object.keys(attributes).length ? attributes : undefined,
        })
      }
      reset()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg w-[480px] max-w-[95vw] p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-base font-semibold">Ajouter un événement</h3>
          <button onClick={onClose} className="text-[#666] hover:text-white"><X size={16} /></button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode(MODE_NOTE)}
            className={`px-3 py-1.5 rounded text-xs ${mode === MODE_NOTE ? 'bg-white text-black' : 'bg-[#1a1a1a] text-[#aaa]'}`}
          >Note libre</button>
          <button
            onClick={() => setMode(MODE_LIFECYCLE)}
            className={`px-3 py-1.5 rounded text-xs ${mode === MODE_LIFECYCLE ? 'bg-white text-black' : 'bg-[#1a1a1a] text-[#aaa]'}`}
          >Événement structuré</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[#888] text-xs mb-1">Date / heure</label>
            <input
              type="datetime-local"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2 py-1.5 text-sm text-white"
            />
          </div>

          {mode === MODE_NOTE ? (
            <>
              <div>
                <label className="block text-[#888] text-xs mb-1">Texte (requis, max 5000)</label>
                <textarea
                  value={text}
                  maxLength={5000}
                  onChange={e => setText(e.target.value)}
                  rows={4}
                  className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2 py-1.5 text-sm text-white"
                  placeholder="Ce que tu veux noter…"
                />
              </div>
              <div>
                <label className="block text-[#888] text-xs mb-1">Tags (CSV, optionnel)</label>
                <input
                  type="text"
                  value={tagsCsv}
                  onChange={e => setTagsCsv(e.target.value)}
                  placeholder="ban, retry, sim"
                  className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2 py-1.5 text-sm text-white"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[#888] text-xs mb-1">Type</label>
                <select
                  value={eventType}
                  onChange={e => setEventType(e.target.value)}
                  className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2 py-1.5 text-sm text-white"
                >
                  {LIFECYCLE_EVENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              {selectedLifecycleType?.requiresLinkUrl && (
                <div>
                  <label className="block text-[#888] text-xs mb-1">URL (requis, max 2000)</label>
                  <input
                    type="url"
                    value={linkUrl}
                    maxLength={2000}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2 py-1.5 text-sm text-white"
                  />
                </div>
              )}
              <div>
                <label className="block text-[#888] text-xs mb-1">Note (optionnelle, max 500)</label>
                <textarea
                  value={lifecycleNote}
                  maxLength={500}
                  onChange={e => setLifecycleNote(e.target.value)}
                  rows={3}
                  className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2 py-1.5 text-sm text-white"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs bg-[#1a1a1a] text-[#aaa] hover:text-white"
          >Annuler</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-3 py-1.5 rounded text-xs bg-white text-black disabled:opacity-40 disabled:cursor-not-allowed"
          >{submitting ? 'Envoi…' : 'Ajouter'}</button>
        </div>
      </div>
    </div>
  )
}
