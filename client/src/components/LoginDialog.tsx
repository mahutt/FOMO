import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import { useAuth, type UserType } from '../contexts/AuthContext'
import { SERVER_URL } from '../constants'

export function LoginDialog() {
  const { login, logout, user, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userType, setUserType] = useState<UserType>('student')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isRegistering) {
        await register(email, password, userType)
      } else {
        await login(email, password)
      }
      setIsOpen(false)
      setEmail('')
      setPassword('')
      setIsRegistering(false)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `${isRegistering ? 'Registration' : 'Login'} failed`
      )
    } finally {
      setLoading(false)
    }
  }

  const register = async (
    email: string,
    password: string,
    user_type: UserType
  ) => {
    const response = await fetch(`${SERVER_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, user_type }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Registration failed')
    }

    // const userData = await response.json()
    // const user = {
    //   user_id: userData.user_id,
    //   email: userData.email,
    //   user_type: userData.user_type,
    // }

    // Auto-login after registration
    login(email, password)
  }

  const handleLogout = () => {
    logout()
    setIsOpen(false)
  }

  if (isAuthenticated) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            {user?.email} ({user?.user_type})
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Logged in as:</p>
              <p className="font-medium">{user?.email}</p>
              <p className="text-sm text-muted-foreground capitalize">
                {user?.user_type}
              </p>
            </div>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              Logout
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Login</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isRegistering ? 'Register' : 'Login'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          {isRegistering && (
            <div className="space-y-2">
              <Label htmlFor="userType">User Type</Label>
              <select
                id="userType"
                value={userType}
                onChange={(e) => setUserType(e.target.value as UserType)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                disabled={loading}
              >
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? isRegistering
                ? 'Registering...'
                : 'Logging in...'
              : isRegistering
              ? 'Register'
              : 'Login'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setIsRegistering(!isRegistering)
              setError('')
            }}
            disabled={loading}
          >
            {isRegistering
              ? 'Already have an account? Login'
              : "Don't have an account? Register"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
