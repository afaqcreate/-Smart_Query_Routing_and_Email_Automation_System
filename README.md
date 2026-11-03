# Smart Query Routing and Email Automation System (Query UNI)

[![Live Demo](https://img.shields.io/badge/Demo-aiquerysystem.vercel.app-0070f3?style=for-the-badge&logo=vercel&logoColor=white)](https://aiquerysystem.vercel.app/AllScreens/01_Login/01_login)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com/)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

An AI-powered, multi-role university inquiry management and automated routing platform. Built with **FastAPI**, **Google Gemini AI**, **PostgreSQL (Supabase)**, and modern responsive **Tailwind CSS**.

---

## 📌 Table of Contents
- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [Key Features & Role-Based Access](#-key-features--role-based-access)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation & Local Setup](#-installation--local-setup)
- [Environment Variables](#-environment-variables)
- [Cloud Deployment](#-cloud-deployment)
- [API Documentation](#-api-documentation)
- [Security & Anti-Vulnerability Measures](#-security--anti-vulnerability-measures)
- [Contributors](#-contributors)

---

## 🎯 Overview

Universities process thousands of student emails daily concerning admissions, examination schedules, fee vouchers, scholarship applications, and leave approvals. Manual routing creates administrative delays, misrouted emails, and poor student experience.

**Smart Query Routing & Email Automation System** solves this by:
1. **Single Sign-On (SSO)** via Google OAuth 2.0 with automatic role detection.
2. **Gemini AI Classification**: Understanding student intent, assigning urgency, and routing tickets to the exact department desk.
3. **Dedicated Role Dashboards**: Tailored views for Students, Department Officers, Heads of Department (HODs), and System Admins.
4. **End-to-End Tracking**: Full ticket lifecycle auditing, resolution history, and automated status notifications.
5. **Campus Broadcast System**: University-wide and department-specific announcements with urgent banners and AI draft enhancement.

---

## 🏛 System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend (Vercel)"]
        UI["Tailwind CSS + Vanilla JS UI"]
        S_Dash["Student Portal"]
        H_Dash["HOD Portal"]
        D_Dash["Department Portal"]
        A_Dash["Admin Portal"]
    end

    subgraph Auth["Identity & Access"]
        GOAuth["Google OAuth 2.0 SSO"]
        JWT["Role-Based Access Control"]
    end

    subgraph Backend["FastAPI Backend (Render)"]
        Router["API Gateway / Routers"]
        AIService["Gemini AI Classifier & Polisher"]
        QueryService["Query & Routing Engine"]
        LeaveService["Leave Management Workflow"]
        AnnounceService["Campus Broadcast Service"]
    end

    subgraph Storage["Cloud Database (Supabase)"]
        DB[(PostgreSQL)]
        Pooler["PgBouncer Transaction Pooler"]
    end

    UI --> GOAuth --> JWT --> Router
    Router --> AIService
    Router --> QueryService
    Router --> LeaveService
    Router --> AnnounceService
    QueryService --> Pooler --> DB
    LeaveService --> Pooler --> DB
    AnnounceService --> Pooler --> DB
```

---

## 👥 Key Features & Role-Based Access

### 1. 🎓 Student Portal (`02_Student`)
- **Submit Query**: Submit academic, financial, or administrative queries with priority detection.
- **Real-Time Ticket Tracking**: View status (`Pending`, `In Progress`, `Resolved`, `Closed`), assigned officer, and response timeline.
- **Leave Application**: Apply for medical/casual leave with date pickers and reason details; track HOD approval in real-time.
- **Announcement Feed**: Campus announcements with visual **Urgent Alert** banners and unread counter badges.

### 2. 👔 Head of Department (HOD) Portal (`04_HOD`)
- **Leave Requests Review**: Filter, approve, or reject student leave applications with custom decision remarks.
- **Department Oversight**: View active queries routed to department officers.
- **Student Performance & Attendance**: Overview of student leave frequencies.

### 3. 🏢 Department Officer Portal (`05_Department`)
- **Assigned Queue**: Dedicated queue for department-specific queries (Accounts, Examinations, Admissions, etc.).
- **Ticket Resolution Desk**: Update status, log internal investigation notes, and send email resolutions back to the student.
- **Category & Priority Filters**: Quickly triage critical tickets.

### 4. ⚙️ Super Admin Portal (`06_Admin`)
- **User & Student Management**: Link Google users to student profiles, assign roles (`student`, `hod`, `department`, `admin`), and update department/semester.
- **Campus Broadcast System**:
  - Compose urgent or standard announcements.
  - Target specific departments or broadcast university-wide.
  - **Gemini AI Integration**: One-click "Enhance with Gemini AI" to transform rough notes into polished university notices.
- **System Metrics & Analytics**: Total queries, resolution rates, pending leaves, and active users.

---

## 💻 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5, JavaScript (ES6+), [Tailwind CSS 3.4](https://tailwindcss.com/), Vercel CDN |
| **Backend API** | [FastAPI 0.115+](https://fastapi.tiangolo.com/), [Pydantic v2](https://docs.pydantic.dev/), Uvicorn, Gunicorn |
| **Artificial Intelligence** | [Google GenAI SDK](https://github.com/google-gemini/generative-ai-python) (`gemini-2.5-flash` / `gemini-1.5-pro`) |
| **Database & ORM** | [PostgreSQL](https://www.postgresql.org/), [SQLAlchemy 2.0](https://www.sqlalchemy.org/), [Supabase](https://supabase.com/) Connection Pooler |
| **Authentication** | Google OAuth 2.0 OpenID Connect (`authlib`, `httpx`) |
| **Deployment** | **Vercel** (Frontend) + **Render** (Backend Web Service) + **Supabase** (Database) |

---

## 📂 Project Structure

```
Final year project/
├── Backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── announcement.py     # Campus broadcast & AI polish
│   │   │       ├── auth.py             # Google OAuth2 login & callback
│   │   │       ├── leaves.py           # Student leave submission & HOD approval
│   │   │       ├── query.py            # Ticket creation, routing & resolution
│   │   │       ├── stats.py            # Dashboard counters & charts
│   │   │       └── user.py             # User & role management (Admin)
│   │   ├── database/
│   │   │   ├── base.py                 # SQLAlchemy DeclarativeBase
│   │   │   └── connection.py           # Engine with pool_pre_ping & pool_recycle
│   │   ├── models/
│   │   │   ├── table.py                # User, Student, Ticket, Leave, Announcement
│   │   │   └── student_id_counter.py   # Unique auto-increment sequences
│   │   ├── schemas/
│   │   │   └── subschemas.py           # Pydantic v2 validation models
│   │   ├── services/
│   │   │   ├── ai_classifier.py        # Gemini AI prompt engine & classification
│   │   │   ├── auth.py                 # OAuth exchange & token verification
│   │   │   └── query_service.py        # Routing rules & ticket lifecycle
│   │   ├── config.py                   # Environment loader & CORS settings
│   │   └── main.py                     # FastAPI application factory & health checks
│   ├── .env.example                    # Environment template
│   ├── Procfile                        # Render production entrypoint
│   └── requirements.txt                # Pinned production dependencies
│
├── Frontend/
│   ├── AllScreens/
│   │   ├── 01_Login/                   # SSO Google login screen
│   │   ├── 02_Student/                 # Student ticket & leave dashboard
│   │   ├── 04_HOD/                     # HOD leave approvals & metrics
│   │   ├── 05_Department/              # Department officer ticket triage
│   │   └── 06_Admin/                   # Admin user manager & announcements
│   ├── index.html                      # Root entrypoint redirecting to login
│   ├── setGlobal.js                    # Universal API detector (Local vs Cloud)
│   ├── vercel.json                     # Vercel security headers & routing
│   └── package.json                    # Tailwind build scripts
│
├── render.yaml                         # Infrastructure-as-code for Render
└── README.md                           # Documentation
```

---

## 🚀 Installation & Local Setup

### Prerequisites
- **Python 3.10+** (Tested on Python 3.13)
- **Node.js 18+** (Optional, only for compiling Tailwind CSS)
- **PostgreSQL** (Local instance or free Supabase cloud instance)

### 1. Clone the Repository
```bash
git clone https://github.com/afaqcreate/-Smart_Query_Routing_and_Email_Automation_System.git
cd "-Smart_Query_Routing_and_Email_Automation_System/Final year project"
```

### 2. Configure Backend
```bash
cd Backend

# Create & activate a virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file from the example:
```bash
cp .env.example .env
```
Update `.env` with your database URI, Google OAuth keys, and Gemini API key.

Start the FastAPI backend:
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
API runs at `http://127.0.0.1:8000`. Test interactive docs at `http://127.0.0.1:8000/docs`.

### 3. Run Frontend
Open a new terminal and serve the frontend:
```bash
cd "Final year project/Frontend"
# Using Python HTTP server:
python -m http.server 5500
```
Open `http://127.0.0.1:5500/AllScreens/01_Login/01_login.html` in your browser.

> [!NOTE]
> `Frontend/setGlobal.js` automatically detects `127.0.0.1` and routes all API calls to `http://127.0.0.1:8000` during local development.

---

## 🔑 Environment Variables

Configure the following variables in `Backend/.env`:

```ini
# Database Connection (Supabase or Local PostgreSQL)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Google Gemini AI API
GEMINI_API_KEY="AIzaSy..."

# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID="xxxx-xxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxx"
REDIRECT_URI="http://127.0.0.1:8000/api/auth/google/callback"

# Allowed Frontend Origins (comma-separated for CORS)
FRONTEND_ORIGINS="https://aiquerysystem.vercel.app,http://127.0.0.1:5500,http://localhost:5500"
```

---

## ☁️ Cloud Deployment

### 1. Database (Supabase)
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings** > **Database** > **Connection Pooling** (Port `6543`, Session mode).
3. Copy the URI and use it as `DATABASE_URL`. The app creates all tables automatically on boot.

### 2. Backend (Render.com)
1. Create a new **Web Service** on Render and link your GitHub repository.
2. Set:
   - **Root Directory**: `Final year project/Backend`
   - **Environment**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app.main:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`
   - **Health Check Path**: `/healthz`
3. Add the environment variables from the section above.

### 3. Frontend (Vercel)
1. Import repository on [vercel.com](https://vercel.com).
2. Set:
   - **Framework Preset**: `Other`
   - **Root Directory**: `Final year project/Frontend`
3. Hit **Deploy**. The site goes live with HTTPS and global CDN.

---

## 📡 API Documentation

FastAPI automatically generates interactive OpenAPI documentation:
- **Swagger UI**: `/docs`
- **ReDoc**: `/redoc`

### Core Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/healthz` | Public | Cloud health check endpoint |
| `GET` | `/api/auth/google/login` | Public | Initiates Google OAuth consent flow |
| `GET` | `/api/auth/google/callback` | Public | Exchanges code for token & user profile |
| `POST` | `/api/queries/` | Student | Submit new query (AI categorized & routed) |
| `GET` | `/api/queries/my-queries` | Student | Fetch student's own query history |
| `PATCH` | `/api/queries/{id}` | Officer / Admin | Update ticket status & resolution response |
| `POST` | `/api/leaves/` | Student | Submit leave application |
| `GET` | `/api/leaves/department` | HOD | List pending department leave requests |
| `PATCH` | `/api/leaves/{id}/status` | HOD | Approve or reject student leave |
| `GET` | `/api/announcements/` | Authenticated | List campus announcements |
| `POST` | `/api/announcements/` | Admin Only | Broadcast campus announcement |
| `POST` | `/api/announcements/enhance` | Admin Only | Polish announcement draft via Gemini AI |
| `GET` | `/api/admin/users` | Admin Only | List all registered users and roles |
| `PATCH` | `/api/admin/users/{id}/role` | Admin Only | Promote or change user role |

---

## 🛡 Security & Anti-Vulnerability Measures

- **No Plaintext Passwords**: Authentication is exclusively handled via Google OAuth 2.0 OpenID Connect.
- **Strict Role-Based Guardrails**: Sensitive routes (`/api/admin/*`, `/api/announcements/`) enforce role verification dependencies; unauthorized attempts return `403 Forbidden`.
- **Anti-XSS Protection**: HTML entities sanitized on dynamic frontend renders (`Frontend/setGlobal.js`).
- **SQL Injection Prevention**: 100% parameterized queries via SQLAlchemy 2.0 ORM.
- **CORS Protection**: Dynamic whitelist regex strictly allowing registered origins (`aiquerysystem.vercel.app` and local dev).
- **Security Headers**: Standard `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `X-XSS-Protection` injected via `vercel.json`.

---

## 🎓 Academic Project Information
- **Project**: Final Year Project (FYP)
- **Topic**: Smart Query Routing & Email Automation System
- **Repository**: [github.com/afaqcreate/-Smart_Query_Routing_and_Email_Automation_System](https://github.com/afaqcreate/-Smart_Query_Routing_and_Email_Automation_System)
- **Live URL**: [https://aiquerysystem.vercel.app](https://aiquerysystem.vercel.app)
