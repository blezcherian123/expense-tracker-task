from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Date,
    Text
)

from database import Base


class Expense(Base):

    __tablename__ = "expenses"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    title = Column(
        String(200),
        nullable=False
    )

    amount = Column(
        Numeric(12, 2),
        nullable=False
    )

    category = Column(
        String(100),
        nullable=False,
        index=True
    )

    date = Column(
        Date,
        nullable=False,
        index=True
    )

    note = Column(
        Text,
        nullable=True
    )   