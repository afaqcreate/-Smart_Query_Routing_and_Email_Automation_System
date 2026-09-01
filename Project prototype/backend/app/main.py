from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.base import Base
from app.database.connection import engine

from app.models.ticket import create_query_tickets

from app.api.routes.ticket import router as tickets_router


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

app.include_router(tickets_router)



@app.get("/")
def root():

    return {
        "message": "FastAPI backend is running"
    }