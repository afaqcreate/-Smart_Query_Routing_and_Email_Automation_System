from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.schemas.ticket_schemas import TicketCreate, TicketResponse

from app.services.ticket_service import (
    create_ticket,
    get_tickets,
    get_ticket
)


router = APIRouter(
    prefix="/api/tickets",
    tags=["Tickets"]
)


@router.post("/", response_model=TicketResponse)
def create_new_ticket(
    ticket: TicketCreate,
    db: Session = Depends(get_db)
):

    return create_ticket(db, ticket)


@router.get("/", response_model=list[TicketResponse])
def read_tickets(
    db: Session = Depends(get_db)
):

    return get_tickets(db)


@router.get("/{ticket_id}", response_model=TicketResponse)
def read_ticket(
    ticket_id: int,
    db: Session = Depends(get_db)
):

    return get_ticket(db, ticket_id)