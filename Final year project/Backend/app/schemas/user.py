from pydantic import BaseModel


class UserCreate(BaseModel):

    name: str

    role: str

    email: str


class UserResponse(BaseModel):

    id: int

    name: str

    email: str

    role: str


    class Config:
        from_attributes = True  