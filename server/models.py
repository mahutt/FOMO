from sqlmodel import Field, SQLModel
from enum import Enum
from typing import Optional


class UserType(str, Enum):
    STUDENT = "student"
    ADMIN = "admin"


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    password: str
    user_type: UserType
