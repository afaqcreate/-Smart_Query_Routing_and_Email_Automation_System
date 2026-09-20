from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.route import RouteCreate, RouteResponse
from app.services.route import create_route, get_routes, get_route

router = APIRouter(prefix="/api/route", 
                   tags=["Route"])

@router.post("/", response_model=RouteResponse)

def create_new_route(
    query_id: int,                        # Added query_id requirement
    route_in: RouteCreate,                 # Renamed ticket -> route_in
    db: Session = Depends(get_db)
):
    return create_route(db, route_in, query_id=query_id) # Forwarded query_id to service

@router.get("/", response_model=list[RouteResponse])

def read_routes(db: Session = Depends(get_db)):
    return get_routes(db)

@router.get("/{route_id}", response_model=RouteResponse)

def read_route(route_id: int, db: Session = Depends(get_db)):
    route = get_route(db, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route
