from pydantic import BaseModel, ConfigDict, EmailStr

class UserCreate(BaseModel):
    name: str | None = None 
    role: str
    email: EmailStr
    department_id: int

class UserResponse(BaseModel):
    id: int
    name: str | None
    email: str
    role: str
    department_id: int

    model_config = ConfigDict(from_attributes=True)
