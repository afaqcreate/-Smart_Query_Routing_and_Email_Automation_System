from pydantic import BaseModel


class RouteCreate(BaseModel):

    destination: str


class RouteResponse(BaseModel):

    route_id: int

    query_id: int

    destination: str

    route_at: str
    
    class Config:
        from_attributes = True  