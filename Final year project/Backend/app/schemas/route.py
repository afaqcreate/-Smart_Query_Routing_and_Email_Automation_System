from pydantic import BaseModel


class RouteCreate(BaseModel):

    destination: str

    routed_at: str


class RouteResponse(BaseModel):

    route_id: int

    query_id: int

    destination: str

    routed_at: str


    class Config:
        from_attributes = True  