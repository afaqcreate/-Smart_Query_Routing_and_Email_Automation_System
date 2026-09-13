from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.department import router as department_router
from app.api.routes.escalation import router as escalation_router
from app.api.routes.query import router as query_router
from app.api.routes.route import router as route_router
from app.api.routes.user import router as user_router
from app.database.base import Base
from app.database.connection import engine
# Important: This wildcard import is required here so SQLAlchemy registers 
# the tables before create_all() is executed.
from app.models.table import * 

# Safe for local dev prototyping. Remove this line once you integrate Alembic migrations.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="My Project API",
    version="1.0.0"
)

# CORS Configuration for local frontend environments (like VS Code Live Server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registering all API routers
app.include_router(user_router)
app.include_router(query_router)
app.include_router(route_router)
app.include_router(department_router)
app.include_router(escalation_router)


@app.get("/", tags=["Root"])
def root():
    return {
        "status": "healthy",
        "message": "FastAPI Student Query Management backend is running smoothly."
    }
