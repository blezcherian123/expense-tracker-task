from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from models import Expense
from schemas import ExpenseCreate, ExpenseUpdate


# CREATE EXPENSE

def create_expense(db: Session, expense: ExpenseCreate):

    db_expense = Expense(**expense.model_dump())

    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)

    return db_expense


# GET ALL EXPENSES WITH FILTERS

def get_expenses(
    db: Session,
    category: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    title: str | None = None
):

    query = db.query(Expense)

    if category:
        query = query.filter(
            Expense.category == category
        )

    if from_date:
        query = query.filter(
            Expense.date >= from_date
        )

    if to_date:
        query = query.filter(
            Expense.date <= to_date
        )

    if title:
        query = query.filter(
            Expense.title.ilike(f"%{title}%")
        )

    return query.order_by(
        Expense.date.desc(),
        Expense.id.desc()
    ).all()


# GET ALL DISTINCT CATEGORIES
# Returns every category that has ever been entered,
# regardless of any filters applied to the expense list.

def get_categories(db: Session):

    rows = db.query(
        Expense.category
    ).distinct().filter(
        Expense.category.isnot(None)
    ).order_by(
        Expense.category
    ).all()

    return [category for (category,) in rows if category]


# GET EXPENSE BY ID

def get_expense_by_id(db: Session, expense_id: int):

    return db.query(Expense).filter(
        Expense.id == expense_id
    ).first()


# UPDATE EXPENSE

def update_expense(
    db: Session,
    expense_id: int,
    expense_data: ExpenseUpdate
):

    db_expense = get_expense_by_id(db, expense_id)

    if not db_expense:
        return None

    for key, value in expense_data.model_dump().items():
        setattr(db_expense, key, value)

    db.commit()
    db.refresh(db_expense)

    return db_expense


# DELETE EXPENSE

def delete_expense(db: Session, expense_id: int):

    db_expense = get_expense_by_id(db, expense_id)

    if not db_expense:
        return None

    db.delete(db_expense)
    db.commit()

    return db_expense


# MONTHLY SUMMARY

def get_monthly_summary(
    db: Session,
    month: int,
    year: int
):

    query = db.query(Expense).filter(
        extract("month", Expense.date) == month,
        extract("year", Expense.date) == year
    )

    total_amount = query.with_entities(
        func.coalesce(func.sum(Expense.amount), 0)
    ).scalar()

    total_count = query.count()

    category_summary = (
        query.with_entities(
            Expense.category,
            func.sum(Expense.amount).label("total")
        )
        .group_by(Expense.category)
        .all()
    )

    return {
        "month": month,
        "year": year,
        "total_expenses": float(total_amount),
        "expense_count": total_count,
        "category_breakdown": [
            {
                "category": category,
                "amount": float(amount)
            }
            for category, amount in category_summary
        ]
    }