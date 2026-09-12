from sqlalchemy.orm import Session

from app.models.table import Route
from app.schemas.route import RouteCreate


def create_route(db: Session, route_data: RouteCreate):

    route = Route(
        destination=route_data.destination
    )

    db.add(route)

    db.commit()

    db.refresh(route)

    return route


def get_routes(db: Session):

    return db.query(Route).all()


def get_route(db: Session, route_id: int):

    return db.query(Route).filter(Route.id == route_id).first()