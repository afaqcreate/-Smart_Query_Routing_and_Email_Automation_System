from datetime import datetime, timedelta, timezone
from sqlalchemy import Column, Integer, String, DateTime, Sequence

from app.database.base import Base


PKT = timezone(timedelta(hours=5))

def get_pkt_time():

    return datetime.now(PKT)



class create_query_tickets(Base):


    __tablename__ = "query_tickets"

    ticket_id = Column(Integer, primary_key=True, index=True) #1

    student_id = Column(String(50), nullable=False) #2

    email = Column(String(150), unique=True, nullable=False, index=True) #3

    subject = Column(String(200), nullable=False) #4

    email_body = Column(String, nullable=False) #5

    status = Column(String(50), nullable=False, default="pending") #6

    created_at = Column(DateTime, default=get_pkt_time, nullable=False) #7
