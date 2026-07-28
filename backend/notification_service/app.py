import os
import sys
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add the parent backend folder to sys.path to allow importing from the common folder
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common import db

# Initialize Firestore
db.init_db()

app = FastAPI(title="Slip Vault Notification Service (Polling)", version="1.0.0")

origins = [
    "https://slip-vault.com",
    "https://www.slip-vault.com",
    "https://api.slip-vault.com",
    "https://notifications.slip-vault.com",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:8001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProcessingCallbackRequest(BaseModel):
    status: str  # "COMPLETED" or "ERROR"
    data: dict

# In-memory status cache for instant polling lookups
invoice_statuses = {}

@app.post("/api/invoices/{invoice_id}/callback")
async def processing_callback(invoice_id: str, req: ProcessingCallbackRequest):
    """Callback endpoint for the worker to notify of completion/error"""
    try:
        # Cache the result for quick client polling
        invoice_statuses[invoice_id] = {
            "status": req.status,
            "data": req.data
        }
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to handle processing callback: {str(e)}"
        )

@app.get("/api/invoices/{invoice_id}/status")
async def get_invoice_status(invoice_id: str):
    """Client polling endpoint to check invoice status"""
    # 1. Check in-memory cache first
    if invoice_id in invoice_statuses:
        return invoice_statuses[invoice_id]

    # 2. Check Firestore Database
    try:
        inv = db.get_invoice_by_id(invoice_id)
        if inv:
            return {
                "status": inv.get("status"),
                "data": inv
            }
    except Exception:
        pass

    # 3. Default fallback to PROCESSING
    return {
        "status": "PROCESSING",
        "data": None
    }

@app.get("/")
async def root():
    return {"message": "Slip Vault Notification Polling Service is running."}
