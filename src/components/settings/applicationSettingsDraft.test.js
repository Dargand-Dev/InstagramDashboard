import test from 'node:test'
import assert from 'node:assert/strict'
import { changeForValue, makeApplicationSettingsPayload, updateApplicationSettingsDraft } from './applicationSettingsDraft.js'

const snapshot = {
  revision: 'rev-1',
  groups: [{ id: 'general', fields: [
    { key: 'app.enabled', label: 'Activé', type: 'boolean', value: true, overridden: false },
    { key: 'app.count', label: 'Nombre', type: 'integer', value: 2, min: 0, max: 10, overridden: true },
    { key: 'app.names', label: 'Noms', type: 'string-list', value: ['a'], overridden: true },
    { key: 'app.windows', label: 'Créneaux', type: 'windows', value: [{ start: '12:00', end: '13:00' }], overridden: false },
    { key: 'app.secret', label: 'Secret', type: 'string', secret: true, value: null, configured: true, overridden: true },
  ] }],
}

test('le brouillon ignore une valeur inchangée et un secret vide non touché', () => {
  assert.equal(changeForValue(snapshot.groups[0].fields[0], true), null)
  assert.equal(changeForValue(snapshot.groups[0].fields[4], ''), null)
})

test('le patch ne transmet que les champs modifiés, avec les types attendus', () => {
  const changes = {
    'app.enabled': { action: 'update', value: false },
    'app.count': { action: 'update', value: '4' },
    'app.names': { action: 'update', value: ['a', 'b'] },
    'app.windows': { action: 'update', value: [{ start: '08:30', end: '09:30' }] },
  }
  assert.deepEqual(makeApplicationSettingsPayload(snapshot, changes), {
    revision: 'rev-1',
    updates: {
      'app.enabled': false,
      'app.count': 4,
      'app.names': ['a', 'b'],
      'app.windows': [{ start: '08:30', end: '09:30' }],
    },
    resets: [],
  })
})

test('un secret est envoyé seulement après saisie ou effacement explicite', () => {
  assert.deepEqual(makeApplicationSettingsPayload(snapshot, {
    'app.secret': { action: 'update', value: '' },
  }).updates, { 'app.secret': '' })
  assert.deepEqual(makeApplicationSettingsPayload(snapshot, {
    'app.secret': { action: 'reset' },
  }).resets, ['app.secret'])
  assert.deepEqual(makeApplicationSettingsPayload(snapshot, {}).updates, {})
})

test('un nombre invalide bloque le patch sans envoyer NaN', () => {
  assert.throws(
    () => makeApplicationSettingsPayload(snapshot, { 'app.count': { action: 'update', value: '4.5' } }),
    /Nombre/,
  )
})

test('un créneau incomplet bloque le patch', () => {
  assert.throws(
    () => makeApplicationSettingsPayload(snapshot, { 'app.windows': { action: 'update', value: [{ start: '08:30', end: '' }] } }),
    /Créneaux/,
  )
})

test('la révision du premier changement reste figée après un refetch', () => {
  const first = updateApplicationSettingsDraft({ baseRevision: null, changes: {} }, 'rev-1', 'app.count', { action: 'update', value: '4' })
  const second = updateApplicationSettingsDraft(first, 'rev-2', 'app.enabled', { action: 'update', value: false })
  assert.equal(second.baseRevision, 'rev-1')
  assert.equal(makeApplicationSettingsPayload({ ...snapshot, revision: 'rev-2' }, second.changes, second.baseRevision).revision, 'rev-1')
  assert.deepEqual(updateApplicationSettingsDraft(second, 'rev-2', 'app.count', null).changes, {
    'app.enabled': { action: 'update', value: false },
  })
  const conflicted = { ...second, conflict: true }
  const cleared = updateApplicationSettingsDraft(updateApplicationSettingsDraft(conflicted, 'rev-2', 'app.count', null), 'rev-2', 'app.enabled', null)
  assert.equal(cleared.baseRevision, null)
  assert.equal(cleared.conflict, false)
})
