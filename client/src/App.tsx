import { useEffect, useState } from 'react'
import { Button } from './components/ui/button'
import { RoomUsageChart, type Slot } from './components/RoomUsageChart'
import { CalendarDropdown } from './components/calendar-dropdown'
import { RoomStats } from './components/room-stats'
import { SERVER_URL } from './constants'

// Slot interface moved into RoomUsageChart for reuse.

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

const defaultStartDate = new Date()
// make default end date one day after start date
const defaultEndDate = new Date()
defaultEndDate.setDate(defaultStartDate.getDate() + 1)

function App() {
  const [startDate, setStartDate] = useState<Date | undefined>(defaultStartDate)
  const [endDate, _] = useState<Date | undefined>(defaultEndDate)
  const [slots, setSlots] = useState<Slot[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!startDate) return
    setLoading(true)
    fetchTimeslotData(startDate)
      .then((data) => setSlots(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [startDate])

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
          <CalendarDropdown date={startDate} setDate={setStartDate} />
          <Button
            variant="outline"
            onClick={() => {
              if (!startDate) return
              setLoading(true)
              fetchTimeslotData(startDate)
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
          <div key={roomId} className="flex flex-row gap-8">
            <RoomUsageChart
              roomId={Number(roomId)}
              slots={roomSlots}
              day={today}
            />
            {startDate && endDate && (
              <RoomStats
                roomId={roomId}
                startDate={toLocalISODate(startDate)}
                endDate={toLocalISODate(endDate)}
              />
            )}
          </div>
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
