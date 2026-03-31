import { create } from 'zustand'
import { queryClient } from '@/lib/queryClient'

const TOKEN_KEY = 'ig_auth_token'
const USER_KEY = 'ig_auth_user'

export const useAuthStore = create((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),

  login: async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Invalid credentials')
    }
    const data = await res.json()
    const token = data.token || data.data?.token
    // Backend returns { token, username, expiresIn } — no user object
    const user = data.user || data.data?.user || { username: data.username || username }

    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({ token, user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    queryClient.clear()
    set({ token: null, user: null, isAuthenticated: false })
  },

  checkAuth: () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      set({ token: null, user: null, isAuthenticated: false })
      return false
    }
    return true
  },

  handleUnauthorized: () => {
    get().logout()
  },
}))
