from pydantic import BaseModel


class UserCreate(BaseModel):

    name: str

    role: str

    department: str

    email: str


class UserResponse(BaseModel):

    user_id: int

    name: str

    email: str

    role: str

    department: str


    class Config:
        from_attributes = True  