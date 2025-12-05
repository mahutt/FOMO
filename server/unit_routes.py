from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from models import Unit, Room
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/units", tags=["units"])


class UnitCreate(BaseModel):
    macAddress: str
    roomId: int


class UnitReassign(BaseModel):
    roomId: int


def get_session():
    from main import engine

    with Session(engine) as session:
        yield session


SessionDep = Depends(get_session)


@router.get("/", response_model=list[Unit])
async def get_all_units(session: Session = SessionDep):
    """Fetch all units"""
    statement = select(Unit)
    units = session.exec(statement).all()
    return units


@router.post("/", response_model=Unit)
async def create_unit(unit_data: UnitCreate, session: Session = SessionDep):
    """Create a new unit"""
    # Check if MAC address already exists
    statement = select(Unit).where(Unit.macAddress == unit_data.macAddress)
    existing_unit = session.exec(statement).first()
    if existing_unit:
        raise HTTPException(status_code=400, detail="MAC address already exists")

    # Validate room exists
    room = session.get(Room, unit_data.roomId)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    unit = Unit(
        macAddress=unit_data.macAddress,
        roomId=unit_data.roomId,
    )

    session.add(unit)
    session.commit()
    session.refresh(unit)
    return unit


@router.put("/{unit_id}/reassign", response_model=Unit)
async def reassign_unit(
    unit_id: int, reassign_data: UnitReassign, session: Session = SessionDep
):
    """Reassign a unit to a different room"""
    # Get the unit
    unit = session.get(Unit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    # Validate new room exists
    room = session.get(Room, reassign_data.roomId)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Update the unit's room
    unit.roomId = reassign_data.roomId

    session.add(unit)
    session.commit()
    session.refresh(unit)
    return unit
