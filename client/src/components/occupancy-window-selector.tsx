import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export const OccupancyWindow = {
  '1': 1,
  '5': 5,
  '15': 15,
  '30': 30,
  '60': 60,
} as const

export type OccupancyWindow =
  (typeof OccupancyWindow)[keyof typeof OccupancyWindow]

export function OccupancyWindowSelector({
  occupancyWindow,
  setOccupancyWindow,
}: {
  occupancyWindow: OccupancyWindow
  setOccupancyWindow: (value: OccupancyWindow) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Occupancy Window: {occupancyWindow} mins
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Set Occupancy Window</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {Object.values(OccupancyWindow).map((value) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={occupancyWindow === value}
            onCheckedChange={() => setOccupancyWindow(value)}
          >
            {value} mins
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
