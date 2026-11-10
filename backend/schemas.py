from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field, ConfigDict


class ExpenseCreate(BaseModel):

    title: str = Field(min_length=1, max_length=200)

    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)

    category: str = Field(min_length=1, max_length=100)

    date: date

    note: str | None = None


class ExpenseUpdate(BaseModel):

    title: str = Field(min_length=1, max_length=200)

    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)

    category: str = Field(min_length=1, max_length=100)

    date: date

    note: str | None = None


class ExpenseResponse(BaseModel):

    id: int
    title: str
    amount: Decimal
    category: str
    date: date
    note: str | None

    model_config = ConfigDict(from_attributes=True)