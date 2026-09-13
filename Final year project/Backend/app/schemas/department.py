from pydantic import BaseModel, ConfigDict, EmailStr

class DepartmentCreate(BaseModel):
    name: str
    contact_email: EmailStr

class DepartmentResponse(BaseModel):
    dept_id: int
    name: str
    contact_email: str

    model_config = ConfigDict(from_attributes=True)
