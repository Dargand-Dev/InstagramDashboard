import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Instagram, Loader2 } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-4">
      <Card className="w-full max-w-sm border-[#1a1a1a] bg-[#111111]">
        <CardHeader className="space-y-4 items-center pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#FAFAFA]">Instagram Automation</h1>
              <p className="text-xs text-[#52525B]">Sign in to your dashboard</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[#A1A1AA] text-sm">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#52525B] focus:border-[#3B82F6] transition-colors duration-150"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#A1A1AA] text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#52525B] focus:border-[#3B82F6] transition-colors duration-150"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white transition-colors duration-150"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
