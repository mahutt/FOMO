import { Legend, RadialBar, RadialBarChart } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { useEffect, useState } from 'react'
import { SERVER_URL } from '@/constants'

export const description = 'A radial chart'

export interface RoomStats {
  reservedPercentage: number
  occupiedPercentage: number
  ghostReservations: number
  averageReservationUse: number
}

const chartConfig = {
  percentage: {
    label: 'Percentage',
  },
  reserved: {
    label: 'Reserved',
    color: 'var(--chart-1)',
  },
  occupied: {
    label: 'Occupied',
    color: 'var(--chart-2)',
  },
  total: {
    label: 'Total',
    color: 'transparent',
  },
} satisfies ChartConfig

export function RoomStats({
  roomId,
  startDate,
  endDate,
  occupancyWindow,
}: {
  roomId: string
  startDate: string
  endDate: string
  occupancyWindow: number
}) {
  const [stats, setStats] = useState<RoomStats | null>(null)

  useEffect(() => {
    async function fetchRoomStats() {
      try {
        const response = await fetch(
          `${SERVER_URL}/stats/${roomId}?start=${startDate}&end=${endDate}&occupancy_window=${occupancyWindow}`
        )
        if (!response.ok) {
          throw new Error('Failed to fetch room stats')
        }
        const data = await response.json()
        setStats(data)
      } catch (error) {
        console.error(error)
      }
    }

    fetchRoomStats()
  }, [roomId, , startDate, endDate, occupancyWindow])

  if (!stats) {
    return <div>Loading...</div>
  }

  return (
    <Card className="w-[400px] flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Room Uilization</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <RadialBarChart
            data={[
              { name: 'total', percentage: 100, fill: 'var(--color-total)' },
              {
                name: 'reserved',
                percentage: stats.reservedPercentage,
                fill: 'var(--color-reserved)',
              },
              {
                name: 'occupied',
                percentage: stats.occupiedPercentage,
                fill: 'var(--color-occupied)',
              },
            ]}
            innerRadius={30}
            outerRadius={110}
          >
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="browser" />}
            />
            <Legend verticalAlign="bottom" />
            <RadialBar dataKey="percentage" background />
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
