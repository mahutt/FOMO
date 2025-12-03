import { useEffect, useState } from 'react'
import { Button } from './components/ui/button'
import { RoomUsageChart, type Slot } from './components/RoomUsageChart'
import { CalendarDropdown } from './components/calendar-dropdown'

// Slot interface moved into RoomUsageChart for reuse.

const SERVER_URL =
  import.meta.env.MODE === 'development'
    ? 'http://localhost:8000'
    : 'https://335guy.com'

function toLocalISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function fetchTimeslotData(date: Date): Promise<Slot[]> {
  const startDate = toLocalISODate(date)

  const end = new Date(date)
  end.setDate(end.getDate() + 1)
  const endDate = toLocalISODate(end)
  const response = await fetch(
    `${SERVER_URL}/slots?start=${startDate}&end=${endDate}`
  )
  if (!response.ok) throw new Error('Failed to fetch timeslots')
  const data = await response.json()
  return data as Slot[]
}

function App() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [slots, setSlots] = useState<Slot[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!date) return
    setLoading(true)
    fetchTimeslotData(date)
      .then((data) => setSlots(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [date])

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
          <CalendarDropdown date={date} setDate={setDate} />
          <Button
            variant="outline"
            onClick={() => {
              if (!date) return
              setLoading(true)
              fetchTimeslotData(date)
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
