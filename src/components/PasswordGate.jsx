import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'

const SESSION_KEY = 'ig-dash-session'

function deriveToken(password) {
  return btoa('ig-dash-auth:' + password)
}

export default function PasswordGate({ children }) {
  const password = import.meta.env.VITE_ACCESS_PASSWORD
  const [authenticated, setAuthenticated] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!password) {
      setAuthenticated(true)
      setChecking(false)
      return
    }
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored === deriveToken(password)) {
      setAuthenticated(true)
    }
    setChecking(false)
  }, [password])

  function handleSubmit(e) {
    e.preventDefault()
    if (input === password) {
      localStorage.setItem(SESSION_KEY, deriveToken(password))
      setAuthenticated(true)
      setError(false)
    } else {
      setError(true)
    }
  }

  if (checking) return null
  if (authenticated) return children

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] p-10 w-[360px] flex flex-col items-center gap-6">
        <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center">
          <Lock size={22} className="text-[#555]" />
        </div>

        <div className="text-center">
          <h1 className="text-white text-lg font-semibold">Instagram Dashboard</h1>
          <p className="text-[#555] text-[13px] mt-1.5">Enter password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gate-password" className="text-[11px] text-[#555] font-semibold uppercase tracking-wider">
              Password
            </label>
            <input
              id="gate-password"
              type="password"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(false) }}
              autoFocus
              className={`bg-[#0a0a0a] border text-white rounded-md px-3 py-2 text-sm outline-none transition-colors focus:border-[#333] ${
                error ? 'border-red-500' : 'border-[#1a1a1a]'
              }`}
            />
          </div>

          {error && (
            <p className="text-red-500 text-[13px]">Incorrect password</p>
          )}

          <button
            type="submit"
            className="bg-primary hover:bg-primary/80 text-white rounded-md py-2.5 text-sm font-semibold transition-colors cursor-pointer"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  )
}
