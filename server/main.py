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


@app.get("/rooms/{room_id}/reservation-status")
async def read_room_status(room_id: str) -> RoomStatus:
    return RoomStatus(
        room_id=room_id,
        current_time=1625247600,
        currently_reserved=False,
        current_reservation_ends=None,
        next_reservation_starts=1625251200,
    )


@app.post("/occupancy")
async def log_occupancy(data: list[OccupancyLogEntry]):
    return {"status": "success", "data_received": data}
