from sqlmodel import Field, SQLModel, select, Relationship
from enum import Enum
from typing import Optional, List
from datetime import datetime, timezone


class UserType(str, Enum):
    STUDENT = "student"
    ADMIN = "admin"


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    password: str
    user_type: UserType


class Room(SQLModel, table=True):
    id: int = Field(primary_key=True)
    name: str
    code: str
    building: str

    # Relationship to units (1-to-many)
    units: List["Unit"] = Relationship(back_populates="room")


class Unit(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    macAddress: str = Field(index=True)
    roomId: int = Field(foreign_key="room.id")
    createdAt: datetime = Field(default_factory=lambda: datetime.now())
    lastSync: datetime = Field(default_factory=lambda: datetime.now())

    # Relationship to room (many-to-1)
    room: Room = Relationship(back_populates="units")


# Populate functions


def populate_initial_rooms(session):
    """Populate the database with initial rooms if none exist"""
    existing_rooms = session.exec(select(Room)).all()
    if not existing_rooms:
        initial_rooms = [
            Room(id=18508, name="Netherlands", code="LB 351", building="Webster"),
            Room(id=18510, name="Brazil", code="LB 451", building="Webster"),
            Room(id=18511, name="Lithuania", code="LB 547", building="Webster"),
            Room(id=18512, name="Japan", code="LB 453", building="Webster"),
            Room(id=18518, name="Linda Kay", code="LB 251", building="Webster"),
            Room(id=18520, name="Croatia", code="LB 257", building="Webster"),
            Room(id=18522, name="New Zealand", code="LB 259", building="Webster"),
            Room(id=18523, name="Italy", code="LB 459", building="Webster"),
            Room(id=18524, name="Ukraine", code="LB 518", building="Webster"),
            Room(id=18525, name="South Africa", code="LB 520", building="Webster"),
            Room(id=18526, name="Peru", code="LB 522", building="Webster"),
            Room(id=18528, name="Poland", code="LB 583", building="Webster"),
            Room(id=18529, name="Haiti", code="LB 311", building="Webster"),
            Room(id=18530, name="Australia", code="LB 316", building="Webster"),
            Room(id=18532, name="Syria", code="LB 327", building="Webster"),
            Room(id=18533, name="Zimbabwe", code="LB 328", building="Webster"),
            Room(id=18535, name="Kenya", code="LB 353", building="Webster"),
            Room(id=18536, name="Vietnam", code="LB 359", building="Webster"),
        ]
        for room in initial_rooms:
            session.add(room)
        session.commit()
