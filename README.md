# Smart Query Management

A prototype system for a university Accounts Department that automatically ingests, categorizes, and routes student email queries (fees, scholarships, refunds, etc.) to the right officer. It has a FastAPI + PostgreSQL backend and a lightweight HTML/CSS/JS frontend that simulates the ticket lifecycle: **Ingestion → Categorization → Routing**.

## Features

- **Ticket ingestion** — submit a student query (ID, email, subject, body) through a simple web form.
- **Rule-based auto-categorization** — keyword matching classifies each query into `Fee`, `Scholarship`, `Refund`, or `General`, and assigns a priority and confidence score.
- **Auto-routing** — each category is routed to a specific officer/desk.
- **Ticket storage & retrieval** — tickets are persisted in PostgreSQL and can be listed or fetched by ID via the API.
- **Custom ticket ID sequence** — ticket IDs start from `1092` (e.g. `#ACT-1092`).

## Tech Stack

**Backend**
- Python 3.13, [FastAPI](https://fastapi.tiangolo.com/), Uvicorn
- SQLAlchemy ORM + PostgreSQL (`psycopg2-binary`)
- Pydantic for request/response schemas
- `python-dotenv` for environment configuration

**Frontend**
- Plain HTML, CSS, and vanilla JavaScript (no framework/build step)

## Project Structure

```
Project prototype/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI app entrypoint
│   │   ├── config.py                   # Loads DATABASE_URL from .env
│   │   ├── database/
│   │   │   ├── base.py                 # SQLAlchemy declarative base
│   │   │   └── connection.py           # Engine, SessionLocal, get_db dependency
│   │   ├── models/
│   │   │   ├── ticket.py               # query_tickets table model
│   │   │   └── ticket_id_counter.py    # Resets ticket_id sequence to start at 1092
│   │   ├── schemas/
│   │   │   └── ticket_schemas.py       # TicketCreate / TicketResponse (Pydantic)
│   │   ├── services/
│   │   │   └── ticket_service.py       # Categorization rules + CRUD logic
│   │   └── api/routes/
│   │       └── ticket.py               # /api/tickets endpoints
│   ├── .env                            # DATABASE_URL (not committed in real projects)
│   └── requirement.txt                 # Python dependencies
└── frontend/
    ├── index.html                      # Ticket submission & routing dashboard UI
    ├── css/style.css
    └── js/main.js                      # Calls the backend API and renders results
```

## Getting Started

### Prerequisites
- Python 3.13+
- PostgreSQL running locally (or accessible remotely)
- A modern web browser

### 1. Backend Setup

```bash
cd backend
python -m venv myenv

# Activate the virtual environment
myenv\Scripts\activate       # Windows
source myenv/bin/activate    # macOS/Linux

pip install -r requirement.txt
```

Create a `.env` file inside `backend/` with your database connection string:

```env
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<database_name>"
```

Create the target PostgreSQL database (e.g. `smart_query`) beforehand — tables are created automatically on startup via `Base.metadata.create_all`.

Run the API server:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://127.0.0.1:8000`, and interactive docs at `http://127.0.0.1:8000/docs`.

Optionally, reset the ticket ID sequence to start at `1092`:

```bash
python -m app.models.ticket_id_counter
```

### 2. Frontend Setup

The frontend is static and expects the backend at `http://127.0.0.1:8000`. Serve it with any static server, for example [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code (default port `5500`), or:

```bash
cd frontend
python -m http.server 5500
```

Then open `http://127.0.0.1:5500` in your browser. CORS is already configured on the backend for `http://127.0.0.1:5500` and `http://localhost:5500`.

## API Endpoints

| Method | Endpoint               | Description                       |
|--------|-------------------------|-----------------------------------|
| GET    | `/`                     | Health check                      |
| POST   | `/api/tickets/`         | Create a new ticket                |
| GET    | `/api/tickets/`         | List all tickets                   |
| GET    | `/api/tickets/{ticket_id}` | Get a single ticket by ID       |

### Example: Create a Ticket

```bash
curl -X POST http://127.0.0.1:8000/api/tickets/ \
  -H "Content-Type: application/json" \
  -d '{
        "student_id": "BC200401234",
        "email": "student@example.com",
        "subject": "Fee challan not generated",
        "email_body": "I have not received my fee voucher for this semester."
      }'
```

## Categorization Rules

Tickets are classified by keyword matching in the subject and body, and routed as follows:

|**Category** |**Example Keywords**|**Priority**|**Routed To**|
|:-----------:|:------------------:|:--------:  |:-----------:|
| Fee         | fee, challan, voucher, unpaid, payment, dues      | Medium     | Fee Officer |
| Scholarship | scholarship, financial aid, grant, merit      | High       | Scholarship Officer |
| Refund      | refund, reimbursement, overpayment, chargeback  | Medium     | Refund Officer     |
| General     | *(no keyword match / fallback)*   | Low        | General Officer    |
