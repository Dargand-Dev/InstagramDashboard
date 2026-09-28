function sameValue(field, value) {
  if (field.secret) return false // La valeur serveur n'est jamais renvoyée.
  if (field.type === 'integer' || field.type === 'number') {
    return value !== '' && Number(value) === field.value
  }
  return JSON.stringify(value) === JSON.stringify(field.value)
}

export function changeForValue(field, value) {
  if (field.secret && value === '') return null // Champ vide = secret inchangé.
  return sameValue(field, value) ? null : { action: 'update', value }
}

export function updateApplicationSettingsDraft(draft, revision, key, change) {
  const changes = { ...draft.changes }
  if (change) changes[key] = change
  else delete changes[key]
  const hasChanges = Object.keys(changes).length > 0
  return {
    ...draft,
    // Une synchronisation serveur pendant la saisie ne change pas la base du brouillon.
    baseRevision: hasChanges ? (draft.baseRevision ?? revision) : null,
    conflict: hasChanges ? Boolean(draft.conflict) : false,
    changes,
  }
}

export function makeApplicationSettingsPayload(snapshot, changes, baseRevision = snapshot.revision) {
  const fields = new Map(snapshot.groups.flatMap(group => group.fields.map(field => [field.key, field])))
  const updates = {}
  const resets = []

  for (const [key, change] of Object.entries(changes)) {
    const field = fields.get(key)
    if (!field || !change) continue
    if (change.action === 'reset') {
      if (field.overridden) resets.push(key)
      continue
    }

    let value = change.value
    if (field.type === 'integer' || field.type === 'number') {
      if (value === '' || value === null || !Number.isFinite(Number(value)) ||
          (field.type === 'integer' && !Number.isInteger(Number(value))) ||
          (field.min != null && Number(value) < field.min) ||
          (field.max != null && Number(value) > field.max)) {
        throw new Error(`${field.label || key} : saisissez un nombre valide${field.min != null || field.max != null ? ` entre ${field.min ?? '−∞'} et ${field.max ?? '+∞'}` : ''}.`)
      }
      value = Number(value)
    } else if (field.type === 'string-list') {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) {
        throw new Error(`${field.label || key} : chaque élément de la liste doit être renseigné.`)
      }
      value = value.map(item => item.trim())
    } else if (field.type === 'windows') {
      const isTime = time => typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
      if (!Array.isArray(value) || value.some(window => !isTime(window.start) || !isTime(window.end))) {
        throw new Error(`${field.label || key} : chaque créneau doit avoir une heure de début et de fin (HH:MM).`)
      }
      value = value.map(({ start, end }) => ({ start, end }))
    }
    updates[key] = value
  }

  return { revision: baseRevision, updates, resets }
}
