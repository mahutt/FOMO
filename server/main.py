from fastapi import FastAPI
from pydantic import BaseModel


class RoomStatus(BaseModel):
    room_id: str
    current_time: int
    currently_reserved: bool
    current_reservation_ends: int | None = None
    next_reservation_starts: int | None = None


class OccupancyLogEntry(BaseModel):
    room_id: str
    time: int
    occupied: bool


app = FastAPI()


@app.get("/")
async def root():
    return {"message": "FOMO Server is running!"}

@app.post("/sync/{room_id}")
async def sync(room_id: str, data: list[OccupancyLogEntry]) -> RoomStatus:
   print(data)
   return RoomStatus(
        room_id=room_id,
        current_time=1625247600,
        currently_reserved=False,
        current_reservation_ends=None,
        next_reservation_starts=1625251200,
    )
