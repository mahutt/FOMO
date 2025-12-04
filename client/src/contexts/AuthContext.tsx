import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import { SERVER_URL } from '../constants'

export type UserType = 'student' | 'admin'

export interface User {
  user_id: number
  email: string
  user_type: UserType
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    // Load user from localStorage on mount
    const savedUser = localStorage.getItem('fomo_user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        console.error('Error parsing saved user:', error)
        localStorage.removeItem('fomo_user')
      }
    }
  }, [])

  const login = async (email: string, password: string) => {
    const response = await fetch(`${SERVER_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Login failed')
    }

    const userData = await response.json()
    const user: User = {
      user_id: userData.user_id,
      email: userData.email,
      user_type: userData.user_type,
    }

    setUser(user)
    localStorage.setItem('fomo_user', JSON.stringify(user))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('fomo_user')
  }

  const isAuthenticated = user !== null
  const isAdmin = user?.user_type === 'admin'

  return (
    <AuthContext.Provider
      value={{ user, login, logout, isAuthenticated, isAdmin }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
