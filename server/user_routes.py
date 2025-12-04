from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from models import User, UserType

router = APIRouter(prefix="/users", tags=["users"])


def get_session():
    from main import engine

    with Session(engine) as session:
        yield session


SessionDep = Depends(get_session)


@router.post("/", response_model=User)
async def create_user(user: User, session: Session = SessionDep):
    """Create a new user"""
    # Check if username already exists
    statement = select(User).where(User.username == user.username)
    existing_user = session.exec(statement).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.get("/", response_model=List[User])
async def get_users(session: Session = SessionDep):
    """Get all users"""
    statement = select(User)
    users = session.exec(statement).all()
    return users


@router.get("/{user_id}", response_model=User)
async def get_user(user_id: int, session: Session = SessionDep):
    """Get a user by ID"""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=User)
async def update_user(user_id: int, user_update: User, session: Session = SessionDep):
    """Update a user"""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if new username already exists (if username is being changed)
    if user_update.username != user.username:
        statement = select(User).where(User.username == user_update.username)
        existing_user = session.exec(statement).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")

    user.username = user_update.username
    user.password = user_update.password
    user.user_type = user_update.user_type

    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.delete("/{user_id}")
async def delete_user(user_id: int, session: Session = SessionDep):
    """Delete a user"""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    session.delete(user)
    session.commit()
    return {"message": "User deleted successfully"}
