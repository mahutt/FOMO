import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'

export default function Settings() {
  const { isAdmin, user } = useAuth()

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Settings</h2>
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            You need administrator privileges to access settings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold mb-4">User Information</h3>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p>
              <strong>Role:</strong> Administrator
            </p>
            {user && (
              <p>
                <strong>User:</strong> {user.email}
              </p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">System Configuration</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">Data Retention</h4>
                <p className="text-sm text-muted-foreground">
                  Configure how long to keep historical data
                </p>
              </div>
              <Button variant="outline">Configure</Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">Alert Thresholds</h4>
                <p className="text-sm text-muted-foreground">
                  Set up occupancy alerts and notifications
                </p>
              </div>
              <Button variant="outline">Configure</Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">Hardware Units</h4>
                <p className="text-sm text-muted-foreground">
                  Manage connected sensor units
                </p>
              </div>
              <Button variant="outline">Manage</Button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Export Data</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">Historical Reports</h4>
                <p className="text-sm text-muted-foreground">
                  Export usage data for analysis
                </p>
              </div>
              <Button variant="outline">Export CSV</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
