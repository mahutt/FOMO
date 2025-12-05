from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from models import Room

router = APIRouter(prefix="/rooms", tags=["rooms"])


def get_session():
    from main import engine

    with Session(engine) as session:
        yield session


SessionDep = Depends(get_session)


@router.post("/", response_model=Room)
async def create_room(room: Room, session=SessionDep):
    """Create a new room"""
    # Check if room with this ID already exists
    existing_room = session.get(Room, room.id)
    if existing_room:
        raise HTTPException(status_code=400, detail="Room with this ID already exists")

    session.add(room)
    session.commit()
    session.refresh(room)
    return room


@router.get("/", response_model=List[Room])
async def get_all_rooms(session=SessionDep):
    """Get all rooms"""
    statement = select(Room)
    results = session.exec(statement)
    rooms = results.all()
    return rooms


@router.put("/{room_id}", response_model=Room)
async def update_room(room_id: int, room_update: Room, session=SessionDep):
    """Update a room"""
    existing_room = session.get(Room, room_id)
    if not existing_room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Update fields
    existing_room.name = room_update.name
    existing_room.floor = room_update.floor
    existing_room.building = room_update.building

    session.add(existing_room)
    session.commit()
    session.refresh(existing_room)
    return existing_room


@router.delete("/{room_id}")
async def delete_room(room_id: int, session=SessionDep):
    """Delete a room"""
    room = session.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    session.delete(room)
    session.commit()
    return {"message": f"Room {room_id} deleted successfully"}
