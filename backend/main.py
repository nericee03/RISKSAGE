import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import dashboard, reports, simulation

app = FastAPI(title="RiskSage API", version="3.0.0")

origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router,  prefix="/api/dashboard",  tags=["Dashboard"])
app.include_router(reports.router,    prefix="/api/reports",    tags=["Reports"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["Simulation"])

@app.get("/")
def root():
    return {"status": "ok", "service": "RiskSage v3 — Claude Edition"}

@app.get("/health")
def health():
    return {"status": "healthy"}
