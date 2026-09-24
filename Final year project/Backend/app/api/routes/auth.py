from fastapi import FastAPI, HTTPException, status
from fastapi.responses import RedirectResponse
import httpx
from app.config import *
from database.connection import SessionLocal
from models.table import User

auth = FastAPI()

# STEP A: Redirect user to Google with account chooser forced
@auth.get("/api/auth/google/login")
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
@auth.get("/api/auth/google/callback")
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