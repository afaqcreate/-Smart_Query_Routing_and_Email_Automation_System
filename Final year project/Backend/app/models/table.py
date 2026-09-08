from datetime import datetime, timedelta, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship as Relationship

PKT = timezone(timedelta(hours=5))

def get_pkt_time():

    return datetime.now(PKT)


from app.database.base import Base


class User(Base):

    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=True)

    email = Column(String, unique=True, nullable=False, index=True)

    role = Column(String(50), nullable=False)

    department = Column(String(59), nullable=False)

    queries = Relationship("Query", back_populates="user", cascade="all, delete-orphan")


class Query(Base):

    __tablename__ = "queries"

    query_id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)

    student_id = Column(String(50), nullable=False)

    email = Column(String(150), nullable=False)

    query_subject = Column(String, nullable=False)

    # query_body = Column(String, nullable=False)

    # category = Column(String(50), nullable=False)  # AI-assigned category (Fee, Result, Course, etc.)

    # status = Column(String(20), default= "Pending", nullable=False)

    # submitted_at = Column(String(50), nullable=False)  # Submission timestamp

    user = Relationship("User", back_populates="queries")


class Route(Base):

    __tablename__ = "routes"

    route_id = Column(Integer, primary_key=True, index=True)

    query_id = Column(Integer, ForeignKey("queries.query_id", ondelete= 'CASCADE'), nullable=False)

    destination = Column(String(50), nullable=False)

    routed_at = Column(String(255), nullable=False) # Routing timestamp



# class Email(Base):

#     __tablename__ = "emails"

#     email_id = Column(Integer, primary_key=True, index=True)

#     query_id = Column(Integer, ForeignKey(Query.query_id, ondelete= 'CASCADE'), nullable=False)

#     subject = Column(String(255), nullable=False)

#     body = Column(String(255), nullable=False)

#     recipient = Column(String(255), nullable=False)

#     sent_at = Column(String(255), nullable=False)


class Department(Base):

    __tablename__ = "departments"

    dept_id = Column(Integer, primary_key=True, index=True)

    name = Column(String(50), nullable=False)

    contact_email = Column(String(150), nullable=False)


class Escalation(Base):

    __tablename__ = "escalations"

    escalation_id  = Column(Integer, primary_key=True, index=True)

    query_id = Column(Integer, ForeignKey("queries.query_id", ondelete= 'CASCADE'), nullable=False)

    escalated_to = Column(String(50), nullable=False)

    escalated_at = Column(String, nullable=False)

    reason = Column(String, nullable=False)
 