import os
import sys
import uuid
import asyncio
from fastapi import FastAPI, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

# Add the parent backend folder to sys.path to allow importing from the common folder
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import shared modules and drivers from common package
from common import db
from common.storage import get_storage_provider
from common.messaging import get_messaging_provider
from common.notification import notification_service

# Load local environment variables (resolves to backend/.env if run from backend/)
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

# Initialize Database
db.init_db()

app = FastAPI(title="Slip Vault API (Uploader/API Service)", version="1.0.0")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development; adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request schemas
class ProcessInvoiceRequest(BaseModel):
    image: str  # Base64 string of the processed grayscale image
    id: Optional[str] = None  # Client-supplied unique invoice identifier for notifications

class InvoiceItemSchema(BaseModel):
    sku: Optional[str] = None
    name: str
    quantity: float
    price: float

class InvoiceDataSchema(BaseModel):
    id: Optional[str] = None
    createdAt: Optional[int] = None
    storeName: Optional[str] = None
    storeAddress: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    invoiceNumber: Optional[str] = None
    type: Optional[str] = None
    currency: Optional[str] = None
    items: List[InvoiceItemSchema] = []
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    totalAmount: Optional[float] = None
    confidenceScore: Optional[float] = None
    scannedImage: Optional[str] = None

@app.websocket("/ws/notifications/{invoice_id}")
async def websocket_endpoint(websocket: WebSocket, invoice_id: str):
    """WebSocket endpoint for clients to listen to real-time status updates of an invoice"""
    await notification_service.register(invoice_id, websocket)
    try:
        while True:
            # Keep the socket open and listen for incoming messages (e.g. pings/keepalives)
            await websocket.receive_text()
    except WebSocketDisconnect:
        notification_service.unregister(invoice_id, websocket)
    except Exception:
        notification_service.unregister(invoice_id, websocket)

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
        
        # 2. Upload image to active storage provider (e.g. S3, GCS, or Base64 URI)
        storage_url = get_storage_provider().upload_image(req.image, invoice_id)
        
        # 3. Create placeholder record with status 'PROCESSING'
        db.create_pending_invoice(invoice_id, storage_url)
        
        # 4. Dispatch processing task to active messaging provider (e.g. SQS, GCP Pub/Sub, or Dummy)
        task_payload = {
            "id": invoice_id,
            "s3_url": storage_url
        }
        get_messaging_provider().publish_message(task_payload)
        
        # 5. Poll the database waiting for the worker to update status
        # Poll every 0.5 seconds for a maximum of 15 seconds (30 iterations)
        for _ in range(30):
            await asyncio.sleep(0.5)
            row = db.get_invoice_by_id(invoice_id)
            if not row:
                continue
                
            if row["status"] == "COMPLETED":
                # Notify active listeners that processing completed successfully
                await notification_service.notify_processing_finished(invoice_id, "COMPLETED", row)
                return row
            elif row["status"] == "ERROR":
                rejection = row.get("rejectionReason") or "Document type was invalid or could not be processed."
                # Notify active listeners that processing failed
                await notification_service.notify_processing_finished(invoice_id, "ERROR", {"error": rejection})
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=rejection
                )
        
        # If timeout occurs, inform the user but leave in queue
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Processing timed out. The document is queued and will be processed shortly."
        )

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate invoice processing: {str(e)}"
        )

@app.get("/")
async def root():
    return {"message": "Slip Vault API Service (Uploader) is running."}
