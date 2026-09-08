from pydantic import BaseModel, EmailStr


class QueryCreate(BaseModel):

    student_id: str

    email: str
    
    query_subject: str

    # query_body: str

    # query_subject: str

    # query_body: str

    # category: str

    # status: str

    # submitted_at: str


class QueryResponse(BaseModel):

    query_id: int

    user_id: int

    student_id: str

    email: str

    query_subject: str

    # query_body: str

    # category: str

    # status: str

    # submitted_at: str


    class Config:
        from_attributes = True  