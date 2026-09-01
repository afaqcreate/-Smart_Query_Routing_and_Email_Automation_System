from pydantic import BaseModel

from datetime import datetime


class DepartmentCreate(BaseModel):

    name: str

    contact_email: str


class DepartmentResponse(BaseModel):

    dept_id: int

    name: str

    contact_email: str

    class Config:
        from_attributes = True  