from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.department import router as department_router
from app.api.routes.escalation import router as escalation_router
from app.api.routes.query import router as query_router
from app.api.routes.route import router as route_router
from app.api.routes.user import router as user_router
from app.database.base import Base
from app.database.connection import engine

from fastapi.responses import RedirectResponse
import httpx
from app.config import *
from app.database.connection import SessionLocal
from app.models.table import User

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


@app.get("/api/auth/google/login")
def login_with_google():
    # prompt=select_account forces Google to show the account list every time
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        f"&redirect_uri={REDIRECT_URI}"
        "&prompt=select_account"
    )
    return RedirectResponse(url=google_auth_url)


# STEP B: Google sends the user back here with an Auth Code
@app.get("/api/auth/google/callback")
async def google_callback(code: str):
    db = SessionLocal()
    try:
        # 1. Exchange the code for Google Access Tokens
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": REDIRECT_URI,
        }
        
        async with httpx.AsyncClient() as client:
            token_response = await client.post(token_url, data=token_data)
            token_json = token_response.json()
            access_token = token_json.get("access_token")

            # 2. Fetch authenticated user details from Google
            user_info_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            google_user = user_info_response.json()

        user_email = google_user.get("email")

        # 3. Check PostgreSQL Database for the email
        db_user = db.query(User).filter(User.email == user_email).first()

        # 4. If account does NOT exist in database, raise error
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Email {user_email} is not registered in the system."
            )

        # 5. Access Granted: Return success or redirect to frontend dashboard
        return {
            "status": "success",
            "message": "User verified successfully against PostgreSQL",
            "user": {
                "id": db_user.id,
                "email": db_user.email,
                "name": db_user.name
            }
        }

    finally:
        db.close()
