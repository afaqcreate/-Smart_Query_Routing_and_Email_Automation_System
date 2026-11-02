from fastapi import HTTPException, status
from sqlalchemy import select, exists
from sqlalchemy.orm import Session
from app.models.table import User, Student
from app.schemas.subschemas import StudentCreate, AccountDeleteRequest, UpdateResponseUser, updatecreateUser

def create_standard_user(db: Session, usersdata: StudentCreate):

    user_record = db.scalar(select(User).where(User.email == usersdata.email))
    
    if not user_record:
        user_record = User(
            email=usersdata.email,
            name=usersdata.name,
            role=usersdata.role
        )
    else:
        user_record.name = usersdata.name
        user_record.role = usersdata.role
        
    return user_record


def verificationAccount(db: Session, usersdata: StudentCreate, check_only: bool = False):

    db_target_record = None
    
    try:
        if usersdata.role == "student":
            existing_record = db.scalar(
                select(Student).where(Student.email == usersdata.email)
            )
        else:
            existing_record = db.scalar(
                select(User).where(User.email == usersdata.email)
            )

        if check_only:
            if existing_record:
                return existing_record
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Check complete: Account '{usersdata.email}' is not stored on the database."
                )

        if usersdata.role == "student":
            if not existing_record:
                db_target_record = Student(**usersdata.model_dump())
            else:
                existing_record.name = usersdata.name
                existing_record.role = usersdata.role
                existing_record.roll_number = usersdata.roll_number
                db_target_record = existing_record
        else:
            db_target_record = create_standard_user(db, usersdata)

        if not db_target_record:
            raise ValueError("Failed to initialize or resolve a valid database record layout.")

        db.add(db_target_record)
        db.commit()
        db.refresh(db_target_record)
        return db_target_record

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"Critical Error in Account Verification Flow: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Secure System Trace: {str(e)}"
        )

def deleteAccount(db: Session, delete_info: AccountDeleteRequest):

    try:
        list_for_standard_user = ["admin", "hod", "instructor", "it", "finance", "registrar", "examiner"]
        target_record = None

        if delete_info.role == "student":
            target_record = db.scalar(
                select(Student).where(Student.email == delete_info.email)
            )
            
            
        elif delete_info.role in list_for_standard_user:
            target_record = db.scalar(
                select(User).where(User.email == delete_info.email)
            )

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Validation error: The target role '{delete_info.role}' is not a valid system account type."
            )

        if not target_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Deletion target missing: No account found matching email '{delete_info.email}' with the role '{delete_info.role}'."
            )

        db.delete(target_record)
        db.commit()
        
        return {
            "success": f"Account footprint for '{delete_info.email}' with role '{delete_info.role}' has been permanently removed."
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"Critical Error in Account Deletion Flow: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Account deletion transaction failed securely."
        )

