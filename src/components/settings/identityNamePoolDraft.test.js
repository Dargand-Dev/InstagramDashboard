import test from 'node:test'
import assert from 'node:assert/strict'
import { parseUsernames, namePoolPayload } from './identityNamePoolDraft.js'

test('une liste collée conserve l’ordre, normalise la casse et retire les doublons', () => {
  assert.deepEqual(parseUsernames(' Tommy.KVX \r\ntommy.zrle\ntommy.kvx\n\n'), ['tommy.kvx', 'tommy.zrle'])
})

test('la sauvegarde garde la version lue et autorise une liste custom épuisée', () => {
  assert.deepEqual(namePoolPayload({ enabled: true, firstName: ' Tommy ', text: '', version: 4 }), {
    enabled: true, firstName: 'Tommy', usernames: [], version: 4,
  })
})

test('les pseudos invalides et le prénom manquant bloquent l’enregistrement', () => {
  for (const text of ['bad name', 'bad@name', '.leading', 'trailing.', 'double..dot', 'x'.repeat(31)]) {
    assert.throws(() => namePoolPayload({ enabled: true, firstName: 'Tommy', text }), /Pseudo invalide/)
  }
  assert.throws(() => namePoolPayload({ enabled: true, firstName: '', text: 'tommy.kvx' }), /prénom/)
})

test('revenir à la liste commune garde la liste personnalisée pour plus tard', () => {
  assert.deepEqual(namePoolPayload({ enabled: false, firstName: 'Tommy', text: 'tommy.kvx', version: 0 }), {
    enabled: false, firstName: 'Tommy', usernames: ['tommy.kvx'], version: 0,
  })
})
