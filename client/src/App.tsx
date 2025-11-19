import { useEffect, useState } from 'react'
import { Button } from './components/ui/button'
import { RoomUsageChart, type Slot } from './components/RoomUsageChart'

// Slot interface moved into RoomUsageChart for reuse.

const SERVER_URL =
  import.meta.env.MODE === 'development'
    ? 'http://localhost:8000'
    : 'https://335guy.com'

async function fetchTimeslotData(): Promise<Slot[]> {
  const today = new Date()
  const startDate = today.toISOString().slice(0, 10)
  const end = new Date(today)
  end.setDate(end.getDate() + 1)
  const endDate = end.toISOString().slice(0, 10)
  const response = await fetch(
    `${SERVER_URL}/slots?start=${startDate}&end=${endDate}`
  )
  if (!response.ok) throw new Error('Failed to fetch timeslots')
  const data = await response.json()
  return data as Slot[]
}

function App() {
  const [count, setCount] = useState(0)
  const [slots, setSlots] = useState<Slot[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchTimeslotData()
      .then((data) => setSlots(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Group slots by itemId
  const grouped = slots.reduce<Record<number, Slot[]>>((acc, slot) => {
    acc[slot.itemId] = acc[slot.itemId] || []
    acc[slot.itemId].push(slot)
    return acc
  }, {})

  const today = new Date()

  return (
    <div className="space-y-6 p-4">
      <header className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">FOMO Monitor</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => setCount((c) => c + 1)}>
            Test Button {count}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true)
              fetchTimeslotData()
                .then((data) => setSlots(data))
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false))
            }}
          >
            Refresh
          </Button>
        </div>
      </header>
      {loading && <p className="text-sm">Loading slots...</p>}
      {error && <p className="text-sm text-red-600">Error: {error}</p>}
      <div className="flex flex-col gap-8">
        {Object.entries(grouped).map(([roomId, roomSlots]) => (
          <RoomUsageChart
            key={roomId}
            roomId={Number(roomId)}
            slots={roomSlots}
            day={today}
          />
        ))}
        {!loading && slots.length === 0 && !error && (
          <div className="text-sm text-muted-foreground">
            No slots returned.
          </div>
        )}
      </div>
    </div>
  )
}

export default App
