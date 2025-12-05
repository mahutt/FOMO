from datetime import datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Header
from pydantic import BaseModel
from sqlmodel import Field, Session, SQLModel, create_engine, select
from fastapi_utils.tasks import repeat_every
import httpx
from datetime import timedelta, date
from fastapi.middleware.cors import CORSMiddleware

# Import the User model and routers
from models import Unit, User, Room, populate_initial_rooms
import user_routes
import auth_routes
import room_routes
import unit_routes


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

# Include routers
app.include_router(user_routes.router)
app.include_router(auth_routes.router)
app.include_router(room_routes.router)
app.include_router(unit_routes.router)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.on_event("startup")
@repeat_every(seconds=60 * 60 * 3)  # every 3 hours
async def refresh_todays_slots_task():
    with Session(engine) as session:
        await refresh_todays_slots(session)
        await populate_initial_rooms(session)


@app.get("/")
async def root():
    return {"message": "FOMO Server is running!"}


@app.post("/sync")
async def sync(
    session: SessionDep,
    occupied: int = Query(..., description="1 for occupied, 0 for unoccupied"),
    x_device_mac: str = Header(..., alias="X-Device-MAC"),
) -> RoomStatus:

    # Get room_id from device MAC address
    statement = select(Unit).where(Unit.macAddress == x_device_mac)
    unit = session.exec(statement).first()
    if not unit:
        # create unit and assign random valid room id
        assigned_room = session.exec(select(Room)).first()
        if not assigned_room:
            raise HTTPException(status_code=404, detail="No rooms available to assign")
        room_id = assigned_room.id
        unit = Unit(
            macAddress=x_device_mac,
            roomId=room_id,
        )
        session.add(unit)
        session.commit()
        session.refresh(unit)
    else:
        unit.lastSync = datetime.now()
        session.add(unit)
        session.commit()
        session.refresh(unit)
        room_id = unit.roomId

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


@app.get("/occupancy_logs")
async def get_occupancy_logs(
    session: SessionDep,
    start: Annotated[datetime, Query()],
    end: Annotated[datetime, Query()],
):
    statement = select(OccupancyLog).where(
        OccupancyLog.timestamp >= start,
        OccupancyLog.timestamp <= end,
    )
    results = session.exec(statement)
    logs = results.all()
    return logs


@app.get("/occupancy_logs/{room_id}")
async def get_occupancy_logs(
    room_id: str,
    session: SessionDep,
    start: Annotated[datetime, Query()],
    end: Annotated[datetime, Query()],
):
    statement = select(OccupancyLog).where(
        OccupancyLog.itemId == int(room_id),
        OccupancyLog.timestamp >= start,
        OccupancyLog.timestamp <= end,
    )
    results = session.exec(statement)
    logs = results.all()
    return logs


@app.get("/occupancy_logs/{room_id}/latest")
async def get_latest_occupancy_log(
    room_id: str,
    session: SessionDep,
):
    statement = (
        select(OccupancyLog)
        .where(
            OccupancyLog.itemId == int(room_id),
        )
        .order_by(OccupancyLog.timestamp.desc())
    )
    results = session.exec(statement)
    log = results.first()
    if not log:
        raise HTTPException(
            status_code=404, detail="No occupancy logs found for this room"
        )
    return log


# DATA / ANALYSIS HELPERS


def calculate_occupancy_percentage(
    logs: list[OccupancyLog], occupancy_window: int
) -> int:
    """
    Calculate the percentage of time a room was occupied between 8 AM and 11 PM.

    Each log indicates the room was occupied for at least the past occupancy_window minutes.
    Overlapping periods are merged to avoid double-counting.

    Args:
        logs: List of OccupancyLog entries for a single room
        occupancy_window: Time window in minutes to consider a log as occupied (e.g., 5 minutes)

    Returns:
        Percentage of time occupied (0-100)
    """
    # Filter to only occupied logs
    occupied_logs = [log for log in logs if log.occupied]

    if not occupied_logs:
        return 0

    # Create intervals: each log represents [timestamp - 5min, timestamp]
    intervals = []
    for log in occupied_logs:
        end_time = log.timestamp
        start_time = end_time - timedelta(minutes=occupancy_window)
        intervals.append((start_time, end_time))

    # Sort intervals by start time
    intervals.sort()

    # Merge overlapping intervals
    merged = []
    current_start, current_end = intervals[0]

    for start, end in intervals[1:]:
        if start <= current_end:
            # Overlapping or adjacent - merge them
            current_end = max(current_end, end)
        else:
            # No overlap - save current and start new interval
            merged.append((current_start, current_end))
            current_start, current_end = start, end

    # Don't forget the last interval
    merged.append((current_start, current_end))

    # Calculate total occupied minutes within 8 AM - 11 PM window
    total_occupied_minutes = 0

    for start, end in merged:
        # For each day in the interval, clip to 8 AM - 11 PM
        current_day = start.date()
        end_day = end.date()

        # Handle intervals that might span multiple days
        day = current_day
        while day <= end_day:
            day_start = datetime.combine(day, datetime.min.time().replace(hour=8))
            day_end = datetime.combine(day, datetime.min.time().replace(hour=23))

            # Clip interval to this day's 8 AM - 11 PM window
            clipped_start = max(start, day_start)
            clipped_end = min(end, day_end)

            if clipped_start < clipped_end:
                duration = (clipped_end - clipped_start).total_seconds() / 60
                total_occupied_minutes += duration

            day += timedelta(days=1)

    # Calculate total available minutes (15 hours per day)
    # Determine how many days are covered
    first_log = min(log.timestamp for log in occupied_logs)
    last_log = max(log.timestamp for log in occupied_logs)

    days_covered = (last_log.date() - first_log.date()).days + 1
    total_available_minutes = days_covered * 15 * 60  # 15 hours = 900 minutes per day

    percentage = (total_occupied_minutes / total_available_minutes) * 100
    return round(percentage, 2)


def compute_average_study_session_duration(
    logs: list[OccupancyLog], occupancy_window: int
) -> int:
    """
    Compute the average study session duration in minutes.

    Each occupied log indicates a continuous study session of occupancy_window minutes.
    Consecutive occupied logs are considered part of the same session.

    Args:
        logs: List of OccupancyLog entries for a single room
        occupancy_window: Time window in minutes to consider a log as occupied (e.g., 5 minutes)
    Returns:
        Average study session duration in minutes
    """
    # Filter to only occupied logs and sort by timestamp
    occupied_logs = sorted(
        [log for log in logs if log.occupied], key=lambda x: x.timestamp
    )

    if not occupied_logs:
        return 0

    sessions = []
    session_start = occupied_logs[0].timestamp
    session_end = session_start + timedelta(minutes=occupancy_window)

    for log in occupied_logs[1:]:
        log_start = log.timestamp - timedelta(minutes=occupancy_window)
        log_end = log.timestamp

        if log_start <= session_end:
            # Extend the current session
            session_end = max(session_end, log_end)
        else:
            # Save the current session and start a new one
            sessions.append((session_start, session_end))
            session_start = log.timestamp
            session_end = session_start + timedelta(minutes=occupancy_window)

    # Don't forget the last session
    sessions.append((session_start, session_end))

    # Calculate average duration
    total_duration = sum((end - start).total_seconds() / 60 for start, end in sessions)
    average_duration = total_duration / len(sessions)

    return round(average_duration)


# DATA / ANALYSIS ENDPOINTS
class RoomStats(BaseModel):
    reservedPercentage: int
    occupiedPercentage: int
    ghostReservations: int
    averageStudySessionDuration: int


EARLIEST_RESERVATION_HOURS = 8
LATEST_RESERVATION_HOURS = 23


@app.get("/stats/{room_id}")
async def get_occupancy_logs(
    room_id: str,
    session: SessionDep,
    start: Annotated[datetime, Query()],
    end: Annotated[datetime, Query()],
    occupancy_window: Annotated[int, Query()] = 5,
) -> RoomStats:
    statement = select(Slot).where(
        Slot.itemId == int(room_id),
        Slot.start >= start,
        Slot.end <= end,
    )
    slot_results = session.exec(statement)
    slots: list[Slot] = slot_results.all()

    statement = select(OccupancyLog).where(
        OccupancyLog.itemId == int(room_id),
        OccupancyLog.timestamp >= start,
        OccupancyLog.timestamp <= end,
    )
    results = session.exec(statement)
    logs: list[OccupancyLog] = results.all()

    # Compute the percentage of time between 8 AM and 11 PM that the room is reserved
    maximum_reservation_minutes = (
        LATEST_RESERVATION_HOURS - EARLIEST_RESERVATION_HOURS
    ) * 60

    total_reservation_minutes = 0

    for slot in slots:
        if slot.reserved:
            # We assume each slot is 30 minutes
            total_reservation_minutes += 30

    reserved_percentage = int(
        (total_reservation_minutes / maximum_reservation_minutes) * 100
    )

    # Compute the percentage of time the room is occupied during the day
    occupied_percentage = calculate_occupancy_percentage(logs, occupancy_window)

    # Compute the number of ghost reservations (assume each slot is 30 minutes and = 1 reservation)
    # i.e., the number of slots that are reserved but for which there is no corresponding occupied log
    ghost_reservations = 0

    for slot in slots:
        if slot.reserved:
            # Check if there are any occupied logs during this slot
            slot_logs = [
                log
                for log in logs
                if slot.start <= log.timestamp <= slot.end and log.occupied
            ]
            if not slot_logs:
                ghost_reservations += 1

    # Compute the average study session duration (in minutes) using the occupancy logs and occupancy_window
    # For simplicity, we assume each occupied log indicates a continuous study session of occupancy_window minutes
    average_study_session_duration = compute_average_study_session_duration(
        logs, occupancy_window
    )

    return RoomStats(
        reservedPercentage=int(reserved_percentage),
        occupiedPercentage=int(occupied_percentage),
        ghostReservations=ghost_reservations,
        averageStudySessionDuration=average_study_session_duration,
    )
