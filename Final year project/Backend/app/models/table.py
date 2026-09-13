from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship as Relationship
from sqlalchemy.sql import func

from app.database.base import Base

def get_utc_time():
    return datetime.now(timezone.utc)


class Department(Base):
    __tablename__ = "departments"

    dept_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    contact_email = Column(String(150), nullable=False)
    
    users_relationship = Relationship("User", back_populates="department", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    role = Column(String(50), nullable=False)
    
    department_id = Column(Integer, ForeignKey("departments.dept_id", ondelete="CASCADE"), nullable=False)
    
    department = Relationship("Department", back_populates="users_relationship")
    queries = Relationship("Query", back_populates="user", cascade="all, delete-orphan")


class Query(Base):
    __tablename__ = "queries"

    query_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String(50), nullable=False)
    query_subject = Column(Text, nullable=False)
    query_body = Column(Text, nullable=False)
    category = Column(String(50), nullable=False, index=True)
    status = Column(String(20), default="Pending", nullable=False, index=True)
    
    submitted_at = Column(
        DateTime(timezone=True),
        default=get_utc_time,
        server_default=func.now(),
        nullable=False,
    )
    
    user = Relationship("User", back_populates="queries")
    route = Relationship("Route", back_populates="query", cascade="all, delete-orphan", uselist=False)
    escalations = Relationship("Escalation", back_populates="query", cascade="all, delete-orphan")


class Route(Base):
    __tablename__ = "routes"

    route_id = Column(Integer, primary_key=True, index=True)
    query_id = Column(Integer, ForeignKey("queries.query_id", ondelete="CASCADE"), nullable=False, index=True)
    destination = Column(String(50), nullable=False)
    
    routed_at = Column(
        DateTime(timezone=True),
        default=get_utc_time,
        server_default=func.now(),
        nullable=False,
    )

    query = Relationship("Query", back_populates="route")


class Escalation(Base):
    __tablename__ = "escalations"

    escalation_id = Column(Integer, primary_key=True, index=True)
    query_id = Column(Integer, ForeignKey("queries.query_id", ondelete="CASCADE"), nullable=False, index=True)
    escalated_to = Column(String(50), nullable=False)
    
    escalated_at = Column(
        DateTime(timezone=True),
        default=get_utc_time,
        server_default=func.now(),
        nullable=False,
    )
    reason = Column(Text, nullable=False)
    
    query = Relationship("Query", back_populates="escalations")
