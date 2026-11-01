from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.table import Route
from app.schemas.subschemas import RouteCreate

def create_route(db: Session, route_data: RouteCreate, query_id: int) -> Route:
    route = Route(
        query_id=query_id,
        **route_data.model_dump()
    )
    db.add(route)
    db.commit()
    db.refresh(route)
    return route

def get_routes(db: Session) -> list[Route]:
    return list(db.scalars(select(Route)).all())

def get_route(db: Session, route_id: int) -> Route | None:
    return db.scalars(select(Route).where(Route.route_id == route_id)).first()
