from sqlalchemy.orm import Session

from app.models.ticket import create_query_tickets as tickets
from app.schemas.ticket_schemas import TicketCreate

def categorize_ticket(ticket: TicketCreate):
    subject = ticket.subject.lower()
    email_body = ticket.email_body.lower()

    text = f"{subject} {email_body}"

    rules = {
        "Fee": {
            "keywords": ["fee", "challan", "voucher", "unpaid", "late fine", "bank receipt", "payment", "dues", "billing"],
            "desk": "Fee",
            "label": "Fee Verification & Billing",
            "priority": "Medium",
            "confidence": 99,
            "routed_to" : "Mr. Muhammad ramzan rafique (Fee Officer)"
        },
        "Scholarship": {
            "keywords": ["scholarship", "financial aid", "grant", "sponsorship", "merit", "need-based"],
            "desk": "Scholarship",
            "label": "Scholarship & Financial Aid",
            "priority": "High",
            "confidence": 85,
            "routed_to" : "Ms. Fatima (Scholarship Officer)"
        },
        "Refund": {
            "keywords": [
                "refund",
                "reimbursement",
                "return",
                "withdrawal",
                "duplicate payment",
                "excess payment",
                "overpayment",
                "course withdrawal",
                "cancellation",
                "chargeback"
            ],
            "desk": "Refund",
            "label": "Refund & Reimbursement",
            "priority": "Medium",
            "confidence": 97,
            "routed_to" : "Mr. Muhammad Aslam (Refund Officer)"
        }
    }

    # Trackers to find the maximum match
    best_category = None
    max_matches = 0

    # 1. Loop through every single rule and keyword
    for category, rule in rules.items():
        total_matches = 0
        
        for keyword in rule["keywords"]:
            # .count() calculates how many times the keyword appears
            total_matches += text.count(keyword)
            
        # 2. Compare scores using the greater-than (>) operator
        if total_matches > max_matches:
            max_matches = total_matches
            best_category = {
                "category": category,
                "desk": rule["desk"],
                "label": rule["label"],
                "priority": rule["priority"],
                "confidence": rule["confidence"],
                "routed_to": rule["routed_to"]
            }

    # 3. Return the absolute best match found
    if best_category:
        return best_category

    # 4. Fallback if no keywords matched across any category
    return {
        "category": "general",
        "desk": "general",
        "label": "General Query",
        "priority": "Low",
        "confidence": 50,
        "routed_to": "Saima Jamil (General Officer)"
    }

def create_ticket(db: Session, ticket_data: TicketCreate):



    ticket = tickets(
        student_id=ticket_data.student_id,
        email=ticket_data.email,
        subject=ticket_data.subject,
        email_body=ticket_data.email_body,
        routed_to=categorize_ticket(ticket_data)["routed_to"],
        category=categorize_ticket(ticket_data)["category"],
        priority=categorize_ticket(ticket_data)["priority"],
        confidence=categorize_ticket(ticket_data)["confidence"]
    )

    db.add(ticket)

    db.commit()

    db.refresh(ticket)


    return ticket


def get_tickets(db: Session):

    return db.query(tickets).all()


def get_ticket(db: Session, ticket_id: int):
    if not ticket_id:
        return None
    
    return db.query(tickets).filter(tickets.ticket_id == ticket_id).first()
