import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import (
    FRONTEND_ORIGIN,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI,
)
from app.database.connection import get_db
from app.models.table import User, Student

oauth = APIRouter(prefix="/api/auth", tags=["Auth"])
STATE_COOKIE = "google_oauth_state"


@oauth.get("/google/login")
def login_with_google():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured.")
    state = secrets.token_urlsafe(32)
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "response_type": "code",
        "scope": "openid email profile",
        "redirect_uri": REDIRECT_URI,
        "prompt": "select_account",
        "state": state,
    }
    response = RedirectResponse(
        url="https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    )
    response.set_cookie(
        STATE_COOKIE,
        state,
        httponly=True,
        secure=REDIRECT_URI.startswith("https://"),
        samesite="lax",
        max_age=600,
    )
    return response


@oauth.get("/google/callback", response_class=HTMLResponse)
def google_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    expected_state = request.cookies.get(STATE_COOKIE)
    if not expected_state or not secrets.compare_digest(state, expected_state):
        raise HTTPException(status_code=400, detail="Invalid OAuth state. Please try logging in again.")

    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured.")

    try:
        with httpx.Client(timeout=10.0) as client:
            token_response = client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": REDIRECT_URI,
                },
            )
            token_response.raise_for_status()
            access_token = token_response.json().get("access_token")
            if not access_token:
                raise HTTPException(status_code=400, detail="Google did not return an access token.")

            profile_response = client.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            profile_response.raise_for_status()
            profile = profile_response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Google authentication request failed.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Google returned an invalid response.") from exc

    user_email = profile.get("email")
    if not user_email or not profile.get("email_verified", False):
        raise HTTPException(status_code=403, detail="Google account email could not be verified.")

    db_user = db.scalar(select(Student).where(Student.email == user_email))
    if db_user is None:
        db_user = db.scalar(select(User).where(User.email == user_email))

    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This Google account is not registered in the system.",
        )

    import json
    user_payload = json.dumps(
        {"id": db_user.id, "name": db_user.name, "email": db_user.email, "role": db_user.role, "roll_number": getattr(db_user, "roll_number", None) }
    ).replace("<", "\\u003c")

    html_content = f"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Google sign-in</title></head>
<body>
<p>Authentication complete. This window should close automatically.</p>
<script>
  if (window.opener) {{
    window.opener.postMessage({{
      type: "GOOGLE_AUTH_SUCCESS",
      user: {user_payload}
    }}, {json.dumps(FRONTEND_ORIGIN)});
    window.close();
  }}
</script>
</body>
</html>"""
    response = HTMLResponse(content=html_content)
    response.delete_cookie(STATE_COOKIE)
    return response
