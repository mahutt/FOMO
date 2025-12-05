import { useState, useEffect } from 'react'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import { SERVER_URL } from '@/constants'
import { useAuth } from '../contexts/AuthContext'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Wifi } from 'lucide-react'

export interface Room {
  id: number
  name: string
  code: string
  building: string
}

export interface Unit {
  id: number
  macAddress: string
  roomId: number
  createdAt: string
  lastSync: string
}

async function fetchRooms(): Promise<Room[]> {
  const response = await fetch(`${SERVER_URL}/rooms`)
  if (!response.ok) throw new Error('Failed to fetch rooms')
  const data = await response.json()
  return data as Room[]
}

// Mock function for units - replace with actual API call when available
async function fetchUnits(): Promise<Unit[]> {
  // Simulating API delay
  const response = await fetch(`${SERVER_URL}/units`)
  if (!response.ok) throw new Error('Failed to fetch units')
  const data = await response.json()

  // Parse date strings into Date objects
  const unitsWithParsedDates = data.map((unit: any) => ({
    ...unit,
    // createdAt: new Date(unit.createdAt),
    // lastSync: new Date(unit.lastSync),
  }))

  console.log(unitsWithParsedDates)

  return unitsWithParsedDates as Unit[]
}

interface UnitCardProps {
  unit: Unit
  index: number
}

function UnitCard({ unit, index }: UnitCardProps) {
  const getStatusColor = (lastSync: Date) => {
    const now = new Date()
    const diffMinutes = (now.getTime() - new Date(lastSync).getTime()) / 60000
    if (diffMinutes <= 5) return 'bg-green-500'
    return 'bg-gray-500'
  }

  return (
    <Draggable draggableId={unit.id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`p-3 mb-2 bg-white border rounded-lg shadow-sm cursor-move transition-all ${
            snapshot.isDragging
              ? 'shadow-lg rotate-1 scale-105'
              : 'hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between flex-wrap">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-gray-600" />
              <span className="font-mono text-sm">{unit.macAddress}</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${getStatusColor(
                  new Date(unit.lastSync)
                )}`}
              />
              <Badge variant="outline" className="text-xs">
                {Math.floor(
                  (new Date().getTime() - new Date(unit.lastSync).getTime()) /
                    60000
                )}{' '}
                min ago
              </Badge>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Added: {new Date(unit.createdAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </Draggable>
  )
}

interface RoomDropZoneProps {
  room: Room
  units: Unit[]
}

function RoomDropZone({ room, units }: RoomDropZoneProps) {
  const droppableId = room.id.toString()
  const title = room.name
  const description = `${room.code} - ${room.building}`

  return (
    <Card className="min-h-[200px]">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <Badge variant="secondary" className="w-fit">
          {units.length} unit{units.length !== 1 ? 's' : ''}
        </Badge>
      </CardHeader>
      <CardContent>
        <Droppable droppableId={droppableId}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`min-h-[100px] p-2 rounded-lg border-2 border-dashed transition-colors ${
                snapshot.isDraggingOver
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              {units.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-gray-500 text-sm">
                  {snapshot.isDraggingOver
                    ? 'Drop unit here'
                    : 'No units in this room'}
                </div>
              ) : (
                units.map((unit, index) => (
                  <UnitCard key={unit.id} unit={unit} index={index} />
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </CardContent>
    </Card>
  )
}

export default function Units() {
  const { isAdmin } = useAuth()
  const [rooms, setRooms] = useState<Room[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [roomsData, unitsData] = await Promise.all([
          fetchRooms(),
          fetchUnits(),
        ])
        setRooms(roomsData)
        setUnits(unitsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    if (isAdmin) {
      loadData()
    }
  }, [isAdmin])

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return

    const { source, destination, draggableId } = result

    // If dropped in the same position, do nothing
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return
    }

    const unitId = parseInt(draggableId)
    const newRoomId = parseInt(destination.droppableId)

    try {
      // Make API call to reassign the unit
      const response = await fetch(`${SERVER_URL}/units/${unitId}/reassign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: newRoomId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to reassign unit')
      }

      // Update the unit's roomId in local state only after successful API call
      setUnits((prevUnits) =>
        prevUnits.map((unit) =>
          unit.id === unitId ? { ...unit, roomId: newRoomId } : unit
        )
      )

      console.log(`Unit ${unitId} successfully reassigned to room ${newRoomId}`)
    } catch (error) {
      console.error('Failed to reassign unit:', error)
      setError('Failed to reassign unit. Please try again.')
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">FOMO Unit Management</h2>
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            You need administrator privileges to access settings.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">UNITS</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading units and rooms...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">UNITS</h2>
        <div className="text-center py-8">
          <p className="text-red-600">Error: {error}</p>
        </div>
      </div>
    )
  }

  // Group units by room
  const unitsGroupedByRoom = new Map<number, Unit[]>()

  // Initialize with empty arrays for all rooms
  rooms.forEach((room) => unitsGroupedByRoom.set(room.id, []))

  // Populate with actual units
  units.forEach((unit) => {
    const roomUnits = unitsGroupedByRoom.get(unit.roomId) || []
    roomUnits.push(unit)
    unitsGroupedByRoom.set(unit.roomId, roomUnits)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">FOMO UNITS</h2>
        <div className="text-sm text-gray-600">
          Drag units between rooms to reassign them
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Room sections */}
          {rooms.map((room) => (
            <RoomDropZone
              key={room.id}
              room={room}
              units={unitsGroupedByRoom.get(room.id) || []}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  )
}
