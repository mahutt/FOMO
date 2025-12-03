from datetime import datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Field, Session, SQLModel, create_engine, select
from fastapi_utils.tasks import repeat_every
import httpx
from datetime import timedelta, date
from fastapi.middleware.cors import CORSMiddleware


# Not peristed in DB
class RoomStatus(BaseModel):
    room_id: int
    current_time: int
    currently_reserved: bool
    current_reservation_ends: int | None = None
    next_reservation_starts: int | None = None


# Persisted in DB
class Slot(SQLModel, table=True):
    itemId: int = Field(primary_key=True)
    start: datetime = Field(primary_key=True)
    end: datetime = Field(primary_key=True)
    reserved: bool = Field(default=False)
    occupied: bool = Field(default=False)


class OccupancyLog(SQLModel, table=True):
    itemId: int = Field(primary_key=True)
    timestamp: datetime = Field(primary_key=True)
    occupied: bool


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

            for slot in slots:
                new_slot = Slot(
                    itemId=slot["itemId"],
                    start=datetime.fromisoformat(slot["start"]),
                    end=datetime.fromisoformat(slot["end"]),
                    reserved=("className" in slot),
                    occupied=False,
                )
                statement = select(Slot).where(
                    Slot.itemId == new_slot.itemId,
                    Slot.start == new_slot.start,
                    Slot.end == new_slot.end,
                )
                existing_slot = session.exec(statement).first()
                if existing_slot:
                    new_slot.occupied = existing_slot.occupied
                session.merge(new_slot)
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
async def sync(
    room_id: str,
    session: SessionDep,
    occupied: int = Query(..., description="1 for occupied, 0 for unoccupied"),
) -> RoomStatus:
    occupied_bool = occupied == 1
    now = datetime.now()
    item_id = int(room_id)

    occupancy_log = OccupancyLog(
        itemId=item_id,
        timestamp=now,
        occupied=occupied_bool,
    )
    session.add(occupancy_log)
    session.commit()

    start = now.replace(second=0, microsecond=0)
    start = start.replace(minute=(start.minute // 30) * 30)
    end = start + timedelta(minutes=30)

    statement = select(Slot).where(
        Slot.itemId == item_id,
        Slot.start <= now,
        Slot.end >= now,
    )
    current_time_slot = session.exec(statement).first()

    currently_reserved = False

    if occupied_bool and current_time_slot and not current_time_slot.occupied:
        # Only update if changing from unoccupied to occupied
        current_time_slot.occupied = occupied == 1
        session.add(current_time_slot)
        session.commit()
        session.refresh(current_time_slot)
        print(
            f"Updated occupancy for room {room_id} at {now} to {current_time_slot.occupied}"
        )
        currently_reserved = current_time_slot.reserved
    elif current_time_slot:
        currently_reserved = current_time_slot.reserved
    else:
        new_slot = Slot(
            itemId=item_id,
            start=start,
            end=end,
            reserved=False,
            occupied=occupied_bool,
        )
        session.add(new_slot)
        session.commit()
        print(
            f"Created new slot for room {item_id} at {now} with occupancy {new_slot.occupied}"
        )
        currently_reserved = False

    return RoomStatus(
        room_id=item_id,
        current_time=int(now.timestamp()),
        currently_reserved=currently_reserved,
        current_reservation_ends=(
            int(end.timestamp()) if currently_reserved else None
        ),  # temporary
        next_reservation_starts=int(end.timestamp()),  # temporary
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
