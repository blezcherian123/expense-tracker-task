from datetime import date
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

import models
import crud
import schemas

from database import engine, get_db


# Create database tables
models.Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Personal Expense Tracker API",
    description="API for managing personal expenses",
    version="1.0.0"
)


# ALLOW FRONTEND REQUESTS (works even when the UI is opened
# separately via file://, Live Server, etc.)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)


# CREATE EXPENSE

@app.post("/api/expenses", response_model=schemas.ExpenseResponse)
def create_expense(
    expense: schemas.ExpenseCreate,
    db: Session = Depends(get_db)
):

    return crud.create_expense(db, expense)


# GET ALL EXPENSES WITH FILTERS

@app.get("/api/expenses", response_model=list[schemas.ExpenseResponse])
def get_expenses(
    category: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    title: str | None = None,
    db: Session = Depends(get_db)
):

    if from_date and to_date and from_date > to_date:
        raise HTTPException(
            status_code=400,
            detail="From date cannot be greater than To date"
        )

    return crud.get_expenses(
        db=db,
        category=category,
        from_date=from_date,
        to_date=to_date,
        title=title
    )


# GET ALL CATEGORIES (for the filter dropdown)
# Lists every distinct category that was entered so the dropdown
# always shows the full list, even while a filter is active.
# IMPORTANT: must be declared BEFORE /api/expenses/{expense_id},
# otherwise FastAPI would try to parse "categories" as an integer id.

@app.get("/api/expenses/categories")
def get_categories(db: Session = Depends(get_db)):

    return crud.get_categories(db)


# GET SINGLE EXPENSE

@app.get("/api/expenses/{expense_id}", response_model=schemas.ExpenseResponse)
def get_expense(
    expense_id: int,
    db: Session = Depends(get_db)
):

    expense = crud.get_expense_by_id(db, expense_id)

    if not expense:
        raise HTTPException(
            status_code=404,
            detail="Expense not found"
        )

    return expense


# UPDATE EXPENSE

@app.put("/api/expenses/{expense_id}", response_model=schemas.ExpenseResponse)
def update_expense(
    expense_id: int,
    expense: schemas.ExpenseUpdate,
    db: Session = Depends(get_db)
):

    updated_expense = crud.update_expense(
        db,
        expense_id,
        expense
    )

    if not updated_expense:
        raise HTTPException(
            status_code=404,
            detail="Expense not found"
        )

    return updated_expense


# DELETE EXPENSE

@app.delete("/api/expenses/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db)
):

    deleted_expense = crud.delete_expense(db, expense_id)

    if not deleted_expense:
        raise HTTPException(
            status_code=404,
            detail="Expense not found"
        )

    return {
        "message": "Expense deleted successfully",
        "id": expense_id
    }


# MONTHLY SUMMARY

@app.get("/api/expenses/summary/monthly")
def monthly_summary(
    month: int = Query(ge=1, le=12),
    year: int = Query(ge=1, le=9999),
    db: Session = Depends(get_db)
):

    return crud.get_monthly_summary(
        db,
        month,
        year
    )


# HEALTH CHECK
# For monitoring tools, hosting platforms and browser extensions
# that ping the backend to see if it is alive.

@app.get("/health")
def health_check():

    return {
        "status": "healthy",
        "message": "Expense Tracker API is running"
    }


# OPENAI-COMPATIBLE MODEL LIST
# Monitoring tools and AI clients probe GET /v1/models to discover
# available models. This API is not an LLM server, so answer with an
# empty list instead of a 404.

@app.get("/v1/models")
def list_models():

    return {
        "object": "list",
        "data": []
    }


# SERVE FRONTEND
# Mounted last (after all API routes) so /api/* keeps working.
# html=True serves index.html at "/", and style.css / script.js
# are reachable at their relative paths used by index.html.

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "Frontend"

app.mount(
    "/",
    StaticFiles(directory=FRONTEND_DIR, html=True),
    name="frontend"
)