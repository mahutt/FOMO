from datetime import datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Field, Session, SQLModel, create_engine, select
from fastapi_utils.tasks import repeat_every
import httpx
import asyncio
from datetime import timedelta, date
from fastapi.middleware.cors import CORSMiddleware
import random


# Not peristed in DB
class RoomStatus(BaseModel):
    room_id: str
    current_time: int
    currently_reserved: bool
    current_reservation_ends: int | None = None
    next_reservation_starts: int | None = None


# Not peristed in DB
class OccupancyLogEntry(BaseModel):
    room_id: str
    time: int
    occupied: bool


# Persisted in DB
class Slot(SQLModel, table=True):
    itemId: int = Field(primary_key=True)
    start: datetime = Field(primary_key=True)
    end: datetime = Field(primary_key=True)
    reserved: bool = Field(default=False)
    occupied: bool = Field(default=False)


sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]


async def refresh_todays_slots(session: Session):
    """Refresh slots for today"""
    async with httpx.AsyncClient() as client:
        try:
            headers = {
                "referer": "https://concordiauniversity.libcal.com/reserve/webster",
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            }
            today = date.today()
            data = {
                "lid": "2161",
                "gid": "5032",
                "eid": "-1",
                "seat": "0",
                "seatId": "0",
                "zone": "0",
                "start": today.isoformat(),
                "end": (today + timedelta(days=1)).isoformat(),
                "pageIndex": "0",
                "pageSize": "18",
            }
            response = await client.post(
                "https://concordiauniversity.libcal.com/spaces/availability/grid",
                headers=headers,
                data=data,
            )

            slots = response.json().get("slots", [])
            print(
                f"Successfully fetched {len(slots)} slots using date {today} with status code: {response.status_code}"
            )

            slot_records = []
            for slot in slots:
                slot_record = Slot(
                    itemId=slot["itemId"],
                    start=datetime.fromisoformat(slot["start"]),
                    end=datetime.fromisoformat(slot["end"]),
                    reserved=("className" in slot),
                    occupied=random.randint(0, 1)
                    == 1,  # Randomly assign occupied for demo purposes
                )
                session.merge(slot_record)
            session.commit()
            print("Database updated with latest slots.")

        except Exception as e:
            print("Error fetching slots:", e)


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.on_event("startup")
@repeat_every(seconds=60 * 60 * 3)  # every 3 hours
async def refresh_todays_slots_task():
    with Session(engine) as session:
        await refresh_todays_slots(session)


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


@app.get("/slots")
async def get_slots(
    session: SessionDep,
    start: Annotated[datetime, Query()],
    end: Annotated[datetime, Query()],
):
    statement = select(Slot).where(
        Slot.start >= start,
        Slot.end <= end,
    )
    results = session.exec(statement)
    slots = results.all()
    return slots


@app.get("/slots/{room_id}")
async def get_slots(
    room_id: str,
    session: SessionDep,
    start: Annotated[datetime, Query()],
    end: Annotated[datetime, Query()],
):
    statement = select(Slot).where(
        Slot.itemId == int(room_id),
        Slot.start >= start,
        Slot.end <= end,
    )
    results = session.exec(statement)
    slots = results.all()
    return slots
