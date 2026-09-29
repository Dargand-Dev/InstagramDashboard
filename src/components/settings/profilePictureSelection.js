const LEGACY_LABELS = { BLONDE: 'Blonde', BRUNETTE: 'Brune' }

export function getProfilePictureType(identity) {
  return identity?.profilePictureType || identity?.hairColor || ''
}

export function profilePictureSelection(type) {
  return {
    profilePictureType: type || null,
    hairColor: Object.hasOwn(LEGACY_LABELS, type) ? type : null,
  }
}

export function profilePictureTypeLabel(type, types) {
  return types.find(item => item.id === type)?.label || LEGACY_LABELS[type] || type || 'Non définie'
}
