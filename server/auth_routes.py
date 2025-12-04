from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from models import User, UserType

router = APIRouter(prefix="/auth", tags=["auth"])


def get_session():
    from main import engine

    with Session(engine) as session:
        yield session


SessionDep = Depends(get_session)


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    user_id: int
    username: str
    user_type: UserType
    message: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    user_type: UserType


@router.post("/register", response_model=LoginResponse)
async def register(request: RegisterRequest, session: Session = SessionDep):
    """Register a new user"""
    # Check if username already exists
    statement = select(User).where(User.username == request.username)
    existing_user = session.exec(statement).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Create new user
    user = User(
        username=request.username,
        password=request.password,
        user_type=request.user_type,
    )

    session.add(user)
    session.commit()
    session.refresh(user)

    return LoginResponse(
        user_id=user.id,
        username=user.username,
        user_type=user.user_type,
        message="User registered successfully",
    )


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, session: Session = SessionDep):
    """Login a user"""
    # Find user by username
    statement = select(User).where(User.username == request.username)
    user = session.exec(statement).first()

    if not user or user.password != request.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return LoginResponse(
        user_id=user.id,
        username=user.username,
        user_type=user.user_type,
        message="Login successful",
    )


@router.get("/me/{user_id}", response_model=LoginResponse)
async def get_current_user(user_id: int, session: Session = SessionDep):
    """Get current user info by ID"""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return LoginResponse(
        user_id=user.id,
        username=user.username,
        user_type=user.user_type,
        message="User info retrieved successfully",
    )
