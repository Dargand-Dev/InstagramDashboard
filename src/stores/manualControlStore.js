import { create } from 'zustand'

/**
 * Store global pour la session de contrôle manuel active.
 *
 * - `active` est null tant qu'aucune session n'est ouverte ; sinon, contient
 *   les détails (udid, deviceName, vncUrl, deviceIp, since).
 * - Pas de persist : restauré au mount via GET /api/devices/manual-control/active.
 */
export const useManualControlStore = create((set) => ({
  active: null,
  setActive: (session) => set({ active: session }),
  clear: () => set({ active: null }),
}))
