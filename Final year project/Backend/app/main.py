from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.base import Base
from app.database.connection import engine

from app.models.table import *

from app.api.routes.user import router as user_router
from app.api.routes.query import router as query_router
from app.api.routes.route import router as route_router
from app.api.routes.escalation import router as escalation_router
from app.api.routes.department import router as department_router


Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="My Project API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(query_router)
app.include_router(route_router)
app.include_router(department_router)
app.include_router(escalation_router)



@app.get("/")
def root():

    return {
        "message": "FastAPI backend is running"
    }