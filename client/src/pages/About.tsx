export default function About() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">About FOMO Monitor</h2>
      <div className="prose max-w-none">
        <p className="text-lg text-muted-foreground">
          FOMO (Fear of Missing Out) Monitor is a room occupancy tracking system
          that helps you monitor and analyze room usage patterns.
        </p>

        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">Features</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Real-time room occupancy monitoring</li>
            <li>Historical usage data and analytics</li>
            <li>Interactive charts and visualizations</li>
            <li>Customizable occupancy windows</li>
            <li>Admin dashboard for detailed insights</li>
          </ul>
        </div>

        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">System Components</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Hardware Units:</strong> Arduino-based sensors for
              detecting room occupancy
            </li>
            <li>
              <strong>Server:</strong> Python backend for data collection and
              API endpoints
            </li>
            <li>
              <strong>Client:</strong> React frontend for data visualization and
              management
            </li>
            <li>
              <strong>Infrastructure:</strong> AWS CDK for cloud deployment
            </li>
          </ul>
        </div>

        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">Technology Stack</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Frontend</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>React with TypeScript</li>
                <li>Vite build tool</li>
                <li>Tailwind CSS</li>
                <li>Recharts for visualizations</li>
                <li>React Router for navigation</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Backend</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Python with FastAPI</li>
                <li>Authentication system</li>
                <li>RESTful API endpoints</li>
                <li>Data persistence</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
