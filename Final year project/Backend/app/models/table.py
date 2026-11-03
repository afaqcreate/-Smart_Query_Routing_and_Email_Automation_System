from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


def get_utc_time() -> datetime:
    return datetime.now(timezone.utc)

class Student(Base):
    __tablename__ = "student"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    roll_number: Mapped[str] = mapped_column(String(50), nullable=False)

    queries: Mapped[list["Query"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
        lazy="selectin",
        passive_deletes=True,
    )

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False)

    queries: Mapped[list["Query"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
        passive_deletes=True,
    )
    leave_status: Mapped[Optional["InstructorLeave"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="joined",
        passive_deletes=True,
    )


class Query(Base):
    __tablename__ = "queries"

    query_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("student.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    query_subject: Mapped[str] = mapped_column(Text, nullable=False)
    query_body: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pending", server_default="pending", nullable=False, index=True
    )
    reply: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_time,
        server_default=func.now(),
        nullable=False,
    )
    
    user: Mapped["User"] = relationship(back_populates="queries")
    student: Mapped["Student"] = relationship(back_populates="queries")

    route: Mapped[Optional["Route"]] = relationship(
        back_populates="query",
        cascade="all, delete-orphan",
        uselist=False,
        passive_deletes=True,
    )
    escalations: Mapped[list["Escalation"]] = relationship(
        back_populates="query",
        cascade="all, delete-orphan",
        lazy="selectin",
        passive_deletes=True,
    )
    
    messages: Mapped[list["QueryMessage"]] = relationship(
        back_populates="query",
        cascade="all, delete-orphan",
        lazy="selectin",
        passive_deletes=True,
    )


class Route(Base):
    __tablename__ = "routes"
    __table_args__ = (UniqueConstraint("query_id", name="uq_routes_query_id"),)

    route_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    query_id: Mapped[int] = mapped_column(
        ForeignKey("queries.query_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    destination: Mapped[str] = mapped_column(String(50), nullable=False)
    routed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_time,
        server_default=func.now(),
        nullable=False,
    )

    query: Mapped["Query"] = relationship(back_populates="route")


class Escalation(Base):
    __tablename__ = "escalations"

    escalation_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    query_id: Mapped[int] = mapped_column(
        ForeignKey("queries.query_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    escalated_to: Mapped[str] = mapped_column(String(50), nullable=False)
    escalated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_time,
        server_default=func.now(),
        nullable=False,
    )
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    query: Mapped["Query"] = relationship(back_populates="escalations")


class QueryMessage(Base):
    __tablename__ = "query_messages"

    message_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    query_id: Mapped[int] = mapped_column(
        ForeignKey("queries.query_id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id: Mapped[int] = mapped_column(nullable=False, index=True)
    sender_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    sender_role: Mapped[str] = mapped_column(String(50), nullable=False)
    
    message_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_time,
        server_default=func.now(),
        nullable=False
    )

    query: Mapped["Query"] = relationship(back_populates="messages")


class InstructorLeave(Base):
    __tablename__ = "instructor_leaves"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    is_on_leave: Mapped[bool] = mapped_column(default=False, server_default="false", nullable=False)
    leave_start: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    leave_end: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    leave_reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    auto_reply_enabled: Mapped[bool] = mapped_column(default=True, server_default="true", nullable=False)
    auto_reply_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_time,
        server_default=func.now(),
        onupdate=get_utc_time,
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="leave_status")


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    admin_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    admin_name: Mapped[str] = mapped_column(String(100), default="Administrator", nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="General", nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)
    target_audience: Mapped[str] = mapped_column(String(50), default="all_students", nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_time,
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_time,
        server_default=func.now(),
        onupdate=get_utc_time,
        nullable=False,
    )

    admin: Mapped[Optional["User"]] = relationship()

