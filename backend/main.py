"""
ZUBAAN — FastAPI backend (standalone reference implementation)

Serves two endpoints:
  GET  /api/health    → {"status": "ok"}
  POST /api/log-check → inserts a row into eligibility_checks

DATABASE_URL is read from the environment (Replit built-in PostgreSQL).

Run locally:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(DATABASE_URL)
metadata = MetaData()

sessions = Table(
    "sessions",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("ended_at", DateTime(timezone=True), nullable=True),
)

eligibility_checks = Table(
    "eligibility_checks",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
    Column("session_id", UUID(as_uuid=True), nullable=True),
    Column("household_income_pkr", Integer, nullable=True),
    Column("family_size", Integer, nullable=True),
    Column("province", String, nullable=True),
    Column("has_disability", Boolean, server_default=text("false")),
    Column("is_likely_eligible", Boolean, nullable=True),
    Column("reason", String, nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup if they don't already exist
    with engine.begin() as conn:
        metadata.create_all(bind=engine, checkfirst=True)
    yield


app = FastAPI(title="Zubaan API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your frontend origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LogCheckRequest(BaseModel):
    household_income_pkr: Optional[int] = None
    family_size: Optional[int] = None
    province: Optional[str] = None
    has_disability: Optional[bool] = False
    is_likely_eligible: Optional[bool] = None
    reason: Optional[str] = None


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/log-check", status_code=201)
def log_check(body: LogCheckRequest):
    with engine.begin() as conn:
        conn.execute(
            eligibility_checks.insert().values(
                household_income_pkr=body.household_income_pkr,
                family_size=body.family_size,
                province=body.province,
                has_disability=body.has_disability,
                is_likely_eligible=body.is_likely_eligible,
                reason=body.reason,
            )
        )
    return {"ok": True}
