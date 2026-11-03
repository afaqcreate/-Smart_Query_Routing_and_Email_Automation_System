from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import oauth
from app.api.routes.escalation import escalation
from app.api.routes.message import message
from app.api.routes.query import query
from app.api.routes.route import router
from app.api.routes.user import user
from app.api.routes.admin import admin
from app.api.routes.automation import automat
from app.api.routes.leave import instructor_leave_router
from app.api.routes.announcement import announcement_router
from app.config import FRONTEND_ORIGIN, ALLOWED_ORIGINS
from app.database.base import Base
from app.database.connection import engine
from app.models import table as _models


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        print("[OK] Cloud Database tables verified/created successfully.")
    except Exception as e:
        print(f"[ERROR] Database connection failed during startup: {e}")
    yield


app = FastAPI(
    title="Student Query Management API",
    version="1.0.0",
    description="Backend API for university query management and routing.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(oauth)
app.include_router(user)
app.include_router(query)
app.include_router(router)
app.include_router(escalation)
app.include_router(admin)
app.include_router(automat)
app.include_router(message)
app.include_router(instructor_leave_router)
app.include_router(announcement_router)


@app.get("/", tags=["Root"])
def root():
    return {
        "status": "healthy",
        "message": "Student Query Management API is running.",
    }


@app.get("/health", tags=["Health"])
@app.get("/healthz", tags=["Health"])
def health():
    return {"status": "ok"}
