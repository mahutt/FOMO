import { Routes, Route } from 'react-router'
import { Navigation } from './components/Navigation'
import Dashboard from './pages/Dashboard'
import About from './pages/About'
import Settings from './pages/Settings'
import Units from './pages/Units'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto p-6">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="about" element={<About />} />
          <Route path="units" element={<Units />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
