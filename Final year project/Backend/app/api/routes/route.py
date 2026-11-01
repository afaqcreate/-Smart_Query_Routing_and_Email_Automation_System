from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.connection import get_db
from app.models.table import Query, Route
from app.schemas.subschemas import RouteCreate, RouteResponse, QueryResponse
from app.services.route import create_route, get_route, get_routes

router = APIRouter(prefix="/api/department", tags=["Route"])

# router = APIRouter(prefix="/api/department", tags=["Department Portal"])

@router.get("/{dept_name}/queries", response_model=List[QueryResponse])
def get_department_queries(dept_name: str, db: Session = Depends(get_db)):
    """
    Fetches queries routed specifically to a given department 
    (e.g., 'exam', 'registrar', 'it', 'finance').
    """
    # Find query IDs routed to this department destination
    routes = db.query(Route).filter(Route.destination.ilike(f"%{dept_name}%")).all()
    query_ids = [r.query_id for r in routes]
    
    if not query_ids:
        return []
        
    queries = db.query(Query).filter(Query.query_id.in_(query_ids)).all()
    return queries

@router.post("/", response_model=RouteResponse, status_code=201)
def create_new_route(
    query_id: int,
    route_in: RouteCreate,
    db: Session = Depends(get_db),
):
    if db.get(Query, query_id) is None:
        raise HTTPException(status_code=404, detail="Query not found")
    if db.scalar(select(Route.route_id).where(Route.query_id == query_id)) is not None:
        raise HTTPException(status_code=409, detail="This query already has a route.")
    try:
        return create_route(db, route_in, query_id=query_id)
    except Exception:
        db.rollback()
        raise


@router.get("/", response_model=list[RouteResponse])
def read_routes(db: Session = Depends(get_db)):
    return get_routes(db)


@router.get("/{route_id}", response_model=RouteResponse)
def read_route(route_id: int, db: Session = Depends(get_db)):
    result = get_route(db, route_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Route not found")
    return result
