import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SETTINGS_SECTIONS,
  filterSettingsGroups,
  presentSetting,
  presentSettingsGroups,
} from './settingsPresentation.js'

const field = key => ({ key, label: 'Activé', description: '', type: 'boolean', value: true })

test('les huit sections de navigation ont un identifiant unique', () => {
  assert.deepEqual(SETTINGS_SECTIONS.map(section => section.id), [
    'publications', 'accounts', 'sms', 'identities', 'connections', 'devices', 'security', 'system',
  ])
  assert.ok(SETTINGS_SECTIONS.every(section => section.label && section.description))
  assert.equal(SETTINGS_SECTIONS.find(section => section.id === 'accounts').label, 'Création de comptes')
})

test('chaque champ API apparaît une fois, même quand son groupe doit être découpé', () => {
  const keys = [
    'scheduler.enabled', 'scheduler.timezone', 'scheduler.windows',
    'sms.smsbower.api-url', 'sms.smsbower.api-key', 'sms.smsbower.service',
    'sms.smsbower.country', 'sms.smsbower.max-price', 'sms.smsbower.max-concurrent-rentals',
    'sms.smsbower.retry-attempts', 'sms.smsbower.retry-delay-ms',
    'future.unrecognized-setting',
  ]
  const groups = presentSettingsGroups([{ id: 'mixed', label: 'Ancien groupe', fields: keys.map(field) }])
  assert.deepEqual(groups.flatMap(group => group.fields.map(item => item.key)).sort(), [...keys].sort())
  assert.ok(groups.filter(group => group.section !== 'sms').every(group => group.fields.length <= 5))
  assert.ok(groups.every(group => group.id && group.label && group.description && group.section))
  assert.equal(groups.find(group => group.fields.some(item => item.key === 'future.unrecognized-setting')).section, 'system')
  assert.equal(groups.find(group => group.fields.some(item => item.key === 'future.unrecognized-setting')).advanced, true)
  const smsSelection = presentSettingsGroups([{ fields: [field('sms.provider')] }])[0]
  assert.equal(smsSelection.label, 'Valeurs initiales SMS')
  assert.equal(smsSelection.advanced, true)
})

test('un fournisseur SMS conserve toutes ses options dans un seul accordéon', () => {
  const keys = [
    'sms.smsbower.api-url', 'sms.smsbower.api-key', 'sms.smsbower.service',
    'sms.smsbower.country', 'sms.smsbower.max-price', 'sms.smsbower.max-concurrent-rentals',
    'sms.smsbower.retry-attempts', 'sms.smsbower.retry-delay-ms',
  ]
  const groups = presentSettingsGroups([{ fields: keys.map(field) }])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].id, 'sms-smsbower')
  assert.equal(groups[0].label, 'SMSBower')
  assert.equal(groups[0].advanced, true)
  assert.deepEqual(groups[0].fields.map(item => item.key), keys)
})

test('les réglages courants ont des intitulés et aides propres à leur usage', () => {
  assert.deepEqual(
    (({ label, description, unit }) => ({ label, description, unit }))(presentSetting(field('scheduler.timezone'))),
    {
      label: 'Fuseau horaire des publications',
      description: 'Détermine l’heure locale utilisée pour les créneaux de publication.',
      unit: undefined,
    },
  )
  const sms = presentSetting(field('sms.smsbower.retry-delay-ms'))
  assert.match(sms.label, /SMSBower/)
  assert.match(sms.description, /tentatives/)
  assert.equal(sms.unit, 'ms')
  const unknown = presentSetting(field('future.unrecognized-setting'))
  assert.equal(unknown.label, 'Activé')
  assert.match(unknown.description, /future\.unrecognized-setting/)
})

test('les réglages techniques connus ont aussi une aide explicite', () => {
  for (const key of [
    'telemetry.queue-size', 'appium.ios.xcode-org-id', 'sms.smspool.pool',
    'google.drive.oauth-redirect-uri', 'device.ssh.usb-fallback-enabled',
  ]) {
    const presented = presentSetting({ key, label: '', description: '' })
    assert.ok(presented.label.length > 5, key)
    assert.ok(presented.description.length > 25, key)
    assert.ok(!presented.description.startsWith('Paramètre '), key)
  }
})

test('les clés connues gardent des libellés français même si le backend envoie un libellé anglais', () => {
  const enabled = [
    'telemetry.enabled', 'api.cors.enabled', 'wda.recovery.enabled', 'screenshot.enabled',
    'scraper-stats.enabled', 'scraper-sync.enabled', 'scraper-sync.boot-reconciliation.enabled',
    'discord-webhook.enabled', 'getmysocial.enabled', 'click-tracking.enabled',
    'geo-ip-check.enabled', 'frontend.enabled',
  ]
  for (const key of enabled) {
    const shown = presentSetting({ key, label: 'Enabled', description: '' })
    assert.match(shown.label, /^Activer /, key)
    assert.doesNotMatch(shown.label, /Enabled/, key)
  }
  assert.equal(presentSetting({ key: 'screenshot.retention-days', label: 'Retention days' }).label,
    'Durée de conservation')
  assert.equal(presentSetting({ key: 'device.connectivity.interval-ms', label: 'Interval ms' }).label,
    'Intervalle')
  assert.equal(presentSetting({ key: 'getatext.api-key', label: 'API key', description: 'Clé historique conservée pour compatibilité.' }).description,
    'Clé historique conservée pour compatibilité.')
})

test('la recherche globale ignore accents et casse, et couvre les aides, clés et noms de groupes', () => {
  const groups = presentSettingsGroups([{ id: 'raw', fields: [
    field('scheduler.windows'), field('sms.smsbower.api-key'), field('geo-ip-check.required-country'),
  ] }])
  assert.deepEqual(filterSettingsGroups(groups, 'CRENEAUX').flatMap(group => group.fields.map(item => item.key)),
    ['scheduler.windows'])
  assert.deepEqual(filterSettingsGroups(groups, 'sms.smsbower.api-key').flatMap(group => group.fields.map(item => item.key)),
    ['sms.smsbower.api-key'])
  assert.deepEqual(filterSettingsGroups(groups, 'Pays requis').flatMap(group => group.fields.map(item => item.key)),
    ['geo-ip-check.required-country'])
  assert.ok(filterSettingsGroups(groups, 'aucun résultat').length === 0)
  const securityGroups = presentSettingsGroups([{ fields: [field('dashboard.auth.jwt-expiration')] }])
  assert.deepEqual(filterSettingsGroups(securityGroups, 'sécurité jwt-expiration').flatMap(group => group.fields.map(item => item.key)),
    ['dashboard.auth.jwt-expiration'])
})
