import os
import sys
import uuid
import asyncio
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
import datetime


# Add the parent backend folder to sys.path to allow importing from the common folder
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import shared modules and drivers from common package
from common import db
from common.storage import get_storage_provider
from common.messaging import get_messaging_provider

# Load local environment variables (resolves to backend/.env if run from backend/)
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

# Initialize Database
db.init_db()

app = FastAPI(title="Slip Vault API (Uploader/API Service)", version="1.0.0")
origins = [
    "https://slip-vault.com",
    "https://www.slip-vault.com",
    "https://api.slip-vault.com",
    "https://notifications.slip-vault.com",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:8001",
]
# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from common.schemas import ProcessInvoiceRequest, InvoiceDataSchema


@app.get("/api/invoices", response_model=List[InvoiceDataSchema])
async def get_invoices():
    try:
        return db.get_all_invoices()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@app.post("/api/invoices", response_model=InvoiceDataSchema)
async def create_invoice(invoice: InvoiceDataSchema):
    try:
        invoice_dict = invoice.model_dump()
        db.save_invoice(invoice_dict)
        return invoice_dict
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save invoice: {str(e)}"
        )

@app.delete("/api/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str):
    try:
        db.delete_invoice(invoice_id)
        return {"status": "success", "message": f"Invoice {invoice_id} deleted."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete invoice: {str(e)}"
        )

@app.post("/api/process-invoice")
async def process_invoice(req: ProcessInvoiceRequest):
    try:
        # 1. Get or generate unique invoice identifier
        invoice_id = req.id or str(uuid.uuid4())
        
        # 2. Extract user ID and generate timestamp slug
        user_id = req.userId or "default_user"
        now = datetime.datetime.now()
        timestamp_str = now.strftime("%d-%m-%Y-%H%M%S")

        # Upload image to active storage provider (structured under GCS path)
        storage_url = get_storage_provider().upload_image(
            base64_image=req.image,
            file_name=invoice_id,
            user_id=user_id,
            timestamp_str=timestamp_str,
            store_name="pending"
        )
        
        # 3. Create placeholder record with status 'PROCESSING'
        db.create_pending_invoice(invoice_id, storage_url)
        
        # 4. Dispatch processing task with multi-tenant meta parameters
        task_payload = {
            "id": invoice_id,
            "gcs_url": storage_url,
            "userId": user_id,
            "timestamp_str": timestamp_str
        }
        get_messaging_provider().publish_message(task_payload)
        
        # Return pending invoice state immediately (no database polling)
        return {
            "id": invoice_id,
            "status": "PROCESSING",
            "scannedImage": storage_url
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate invoice processing: {str(e)}"
        )


@app.get("/")
async def root():
    return {"message": "Slip Vault API Service (Uploader) is running."}
