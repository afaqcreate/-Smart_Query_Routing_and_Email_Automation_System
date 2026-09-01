from datetime import datetime, timedelta, timezone
from sqlalchemy import Column, Integer, String, DateTime, Sequence

from app.database.base import Base


PKT = timezone(timedelta(hours=5))

def get_pkt_time():

    return datetime.now(PKT)



class create_query_tickets(Base):


    __tablename__ = "query_tickets"

    ticket_id = Column(Integer, Sequence('query_tickets_ticket_id_seq', start=1092), primary_key=True) #1

    student_id = Column(String(50), nullable=False) #2

    email = Column(String(150), nullable=False) #3

    subject = Column(String(200), nullable=False) #4

    email_body = Column(String, nullable=False) #5

    status = Column(String(50), nullable=False, default="pending") #6

    routed_to = Column(String(100), nullable=True) #7

    category = Column(String(50), nullable=False, default="general") #8

    priority = Column(String(50), nullable=False, default="Low") #9

    confidence = Column(Integer, nullable=False, default=50) #10

    created_at = Column(DateTime, default=get_pkt_time, nullable=False) #11