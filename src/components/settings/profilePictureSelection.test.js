import test from 'node:test'
import assert from 'node:assert/strict'
import { getProfilePictureType, profilePictureSelection, profilePictureTypeLabel } from './profilePictureSelection.js'

test('une ancienne identité conserve sa catégorie et une catégorie personnalisée devient prioritaire', () => {
  assert.equal(getProfilePictureType({ hairColor: 'BLONDE' }), 'BLONDE')
  assert.equal(getProfilePictureType({ profilePictureType: 'portraits', hairColor: 'BLONDE' }), 'portraits')
  assert.equal(getProfilePictureType(null), '')
})

test('choisir un type personnalisé ou aucune photo efface le repli historique', () => {
  assert.deepEqual(profilePictureSelection('portraits'), { profilePictureType: 'portraits', hairColor: null })
  assert.deepEqual(profilePictureSelection(''), { profilePictureType: null, hairColor: null })
  assert.deepEqual(profilePictureSelection('BRUNETTE'), { profilePictureType: 'BRUNETTE', hairColor: 'BRUNETTE' })
})

test('les libellés configurés priment et une sélection absente du catalogue reste visible', () => {
  assert.equal(profilePictureTypeLabel('BLONDE', [{ id: 'BLONDE', label: 'Portraits clairs' }]), 'Portraits clairs')
  assert.equal(profilePictureTypeLabel('BRUNETTE', []), 'Brune')
  assert.equal(profilePictureTypeLabel('portraits', []), 'portraits')
  assert.equal(profilePictureTypeLabel('', []), 'Non définie')
})
