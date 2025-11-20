import { useMemo } from 'react'
import { ComposedChart, XAxis, YAxis, Tooltip, Legend, Area } from 'recharts'
import { ChartContainer, type ChartConfig } from './ui/chart'
import { NAME_PER_ROOM_ID } from '@/lib/room-mapping'

export interface Slot {
  itemId: number
  start: string
  end: string
  reserved: boolean
  occupied: boolean
}

interface RoomUsageChartProps {
  roomId: number
  slots: Slot[]
  day: Date
}

interface Point {
  time: number // ms since epoch
  label: string // HH:MM
  reserved: number
  occupied: number
}

const chartConfig = {
  reserved: {
    label: 'Reserved',
    color: '#6366f1',
  },
  occupied: {
    label: 'Occupied',
    color: '#10b981',
  },
} satisfies ChartConfig

// Convert slot intervals into step function points for charting.
function buildTimeline(slots: Slot[], day: Date): Point[] {
  if (!slots.length) {
    return []
  }
  const dayStart = new Date(day)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setHours(23, 59, 59, 999)

  // Collect boundary times (start and end of every slot plus day boundaries).
  const boundaries = new Set<number>()
  boundaries.add(dayStart.getTime())
  boundaries.add(dayEnd.getTime())
  for (const s of slots) {
    boundaries.add(new Date(s.start).getTime())
    boundaries.add(new Date(s.end).getTime())
  }
  const sorted = Array.from(boundaries).sort((a, b) => a - b)

  function statusAt(time: number) {
    // time belongs to interval [start, end) for slot
    let reserved = 0
    let occupied = 0
    for (const s of slots) {
      const start = new Date(s.start).getTime()
      const end = new Date(s.end).getTime()
      if (start <= time && time < end) {
        if (s.reserved) reserved = 1
        if (s.occupied) occupied = 1
      }
    }
    return { reserved, occupied }
  }

  const points: Point[] = []
  for (const t of sorted) {
    const { reserved, occupied } = statusAt(t)
    const date = new Date(t)
    const label = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    points.push({ time: t, label, reserved, occupied })
  }
  return points
}

export function RoomUsageChart({ roomId, slots, day }: RoomUsageChartProps) {
  const data = useMemo(() => buildTimeline(slots, day), [slots, day])

  if (!data.length) {
    return (
      <div className="border rounded p-4 text-sm text-muted-foreground">
        No data for room {roomId}
      </div>
    )
  }

  return (
    <div className="w-full h-56 border rounded p-2 bg-background">
      <h3 className="text-sm font-medium mb-2">
        Room {NAME_PER_ROOM_ID[roomId as keyof typeof NAME_PER_ROOM_ID]}
      </h3>
      <ChartContainer
        config={chartConfig}
        className="min-h-[200px] h-[200px] w-full"
      >
        <ComposedChart data={data} syncId="rooms">
          <XAxis dataKey="label" interval={Math.floor(data.length / 8)} />
          <YAxis domain={[0, 1]} ticks={[0, 1]} width={30} />
          <Tooltip
            formatter={(value: any, name: string) => [
              value === 1 ? 'Yes' : 'No',
              name,
            ]}
            labelFormatter={(label: string) => label}
          />
          <Legend />
          <Area
            type="stepAfter"
            dataKey="reserved"
            fill="var(--color-reserved)"
            stroke="var(--color-reserved)"
            fillOpacity={0.2}
            isAnimationActive={false}
          />
          <Area
            type="stepAfter"
            dataKey="occupied"
            fill="var(--color-occupied)"
            stroke="var(--color-occupied)"
            fillOpacity={0.2}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}
