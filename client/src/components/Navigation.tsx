import { NavLink } from 'react-router'
import { LoginDialog } from './LoginDialog'
import { useAuth } from '../contexts/AuthContext'

export function Navigation() {
  const { isAdmin } = useAuth()

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <div className="mr-6">
          <h1 className="text-xl font-semibold">FOMO Monitor</h1>
        </div>

        <div className="flex items-center space-x-6">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `text-sm font-medium transition-colors hover:text-primary ${
                isActive ? 'text-foreground' : 'text-muted-foreground'
              }`
            }
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/about"
            className={({ isActive }) =>
              `text-sm font-medium transition-colors hover:text-primary ${
                isActive ? 'text-foreground' : 'text-muted-foreground'
              }`
            }
          >
            About
          </NavLink>

          {isAdmin && (
            <>
              <NavLink
                to="/units"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors hover:text-primary ${
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  }`
                }
              >
                Manage Units
              </NavLink>
              <NavLink
                to="/recordings"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors hover:text-primary ${
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  }`
                }
              >
                Recordings
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors hover:text-primary ${
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  }`
                }
              >
                Settings
              </NavLink>
            </>
          )}
        </div>

        <div className="ml-auto">
          <LoginDialog />
        </div>
      </div>
    </nav>
  )
}
