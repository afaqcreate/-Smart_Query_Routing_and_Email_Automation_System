from sqlalchemy.orm import Session

from app.models.table import Query as tickets, User as UserModel

from app.schemas.query import QueryCreate

# def categorize_ticket(ticket: QueryCreate):
#     subject = ticket.subject.lower()
#     email_body = ticket.email_body.lower()

#     text = f"{subject} {email_body}"

#     rules = {
#         "Fee": {
#             "keywords": ["fee", "challan", "voucher", "unpaid", "late fine", "bank receipt", "payment", "dues", "billing"],
#             "desk": "Fee",
#             "label": "Fee Verification & Billing",
#             "priority": "Medium",
#             "confidence": 99,
#             "routed_to" : "Mr. Muhammad ramzan rafique (Fee Officer)"
#         },
#         "Scholarship": {
#             "keywords": ["scholarship", "financial aid", "grant", "sponsorship", "merit", "need-based"],
#             "desk": "Scholarship",
#             "label": "Scholarship & Financial Aid",
#             "priority": "High",
#             "confidence": 85,
#             "routed_to" : "Ms. Fatima (Scholarship Officer)"
#         },
#         "Refund": {
#             "keywords": [
#                 "refund",
#                 "reimbursement",
#                 "return",
#                 "withdrawal",
#                 "duplicate payment",
#                 "excess payment",
#                 "overpayment",
#                 "course withdrawal",
#                 "cancellation",
#                 "chargeback"
#             ],
#             "desk": "Refund",
#             "label": "Refund & Reimbursement",
#             "priority": "Medium",
#             "confidence": 97,
#             "routed_to" : "Mr. Muhammad Aslam (Refund Officer)"
#         }
#     }

#     # Trackers to find the maximum match
#     best_category = None
#     max_matches = 0

#     # 1. Loop through every single rule and keyword
#     for category, rule in rules.items():
#         total_matches = 0
        
#         for keyword in rule["keywords"]:
#             # .count() calculates how many times the keyword appears
#             total_matches += text.count(keyword)
            
#         # 2. Compare scores using the greater-than (>) operator
#         if total_matches > max_matches:
#             max_matches = total_matches
#             best_category = {
#                 "category": category,
#                 "desk": rule["desk"],
#                 "label": rule["label"],
#                 "priority": rule["priority"],
#                 "confidence": rule["confidence"],
#                 "routed_to": rule["routed_to"]
#             }

#     # 3. Return the absolute best match found
#     if best_category:
#         return best_category

#     # 4. Fallback if no keywords matched across any category
#     return {
#         "category": "general",
#         "desk": "general",
#         "label": "General Query",
#         "priority": "Low",
#         "confidence": 50,
#         "routed_to": "Saima Jamil (General Officer)"
#     }

def create_query(db: Session, ticket_data: QueryCreate):

    user = db.query(UserModel).filter(UserModel.email == ticket_data.email).first()

    if not user:
        user = UserModel(
            email=ticket_data.email,
            role="Student"
        )
    db.add(user)
    db.commit()
    db.refresh(user)

    ticket = tickets(
        user_id=user.id,
        student_id=ticket_data.student_id,
        email=ticket_data.email,
        query_subject=ticket_data.query_subject,
        query_body=ticket_data.query_body,
        category=ticket_data.category,
        status=ticket_data.status,
    )

    db.add(ticket)

    db.commit()

    db.refresh(ticket)


    return ticket


def get_querys(db: Session):

    return db.query(tickets).all()


def get_query(db: Session, query_id: int):
    if not query_id:
        return None
    
    return db.query(tickets).filter(tickets.query_id == query_id).first()
