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

# Programmatically initialize GCP/Emulator resources (GCS bucket & PubSub topics)
def init_gcp_resources():
    storage_provider = os.getenv("STORAGE_PROVIDER", "GCS").upper()
    messaging_provider = os.getenv("MESSAGING_PROVIDER", "GCP_PUBSUB").upper()

    if storage_provider == "GCS":
        bucket_name = os.getenv("GCP_GCS_BUCKET")
        if bucket_name:
            try:
                from google.cloud import storage
                client = storage.Client()
                bucket = client.bucket(bucket_name)
                # Check and create the GCS bucket (works on GCS emulator and cloud)
                if not bucket.exists():
                    client.create_bucket(bucket)
                    print(f"Successfully auto-initialized GCS Bucket: {bucket_name}")
            except Exception as e:
                print(f"Failed to auto-initialize GCS Bucket: {e}")

    if messaging_provider == "GCP_PUBSUB":
        project_id = os.getenv("GCP_PROJECT_ID")
        topic_id = os.getenv("GCP_PUBSUB_TOPIC_ID")
        subscription_id = os.getenv("GCP_PUBSUB_SUBSCRIPTION_ID")
        
        if project_id and topic_id:
            try:
                from google.cloud import pubsub_v1
                from google.api_core.exceptions import AlreadyExists
                
                # Setup Topic (works on Pub/Sub emulator and cloud)
                publisher = pubsub_v1.PublisherClient()
                topic_path = publisher.topic_path(project_id, topic_id)
                try:
                    publisher.create_topic(request={"name": topic_path})
                    print(f"Successfully auto-created GCP Pub/Sub Topic: {topic_id}")
                except AlreadyExists:
                    pass
                    
                # Setup Subscription (works on Pub/Sub emulator and cloud)
                if subscription_id:
                    subscriber = pubsub_v1.SubscriberClient()
                    subscription_path = subscriber.subscription_path(project_id, subscription_id)
                    try:
                        subscriber.create_subscription(
                            request={"name": subscription_path, "topic": topic_path}
                        )
                        print(f"Successfully auto-created GCP Pub/Sub Subscription: {subscription_id}")
                    except AlreadyExists:
                        pass
            except Exception as e:
                print(f"Failed to auto-initialize GCP Pub/Sub resources: {e}")

init_gcp_resources()

app = FastAPI(title="Slip Vault API (Uploader/API Service)", version="1.0.0")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development; adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from common.schemas import ProcessInvoiceRequest, InvoiceDataSchema

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
        
        # 2. Upload image to active storage provider (e.g. GCS or Base64 URI)
        storage_url = get_storage_provider().upload_image(req.image, invoice_id)
        
        # 3. Create placeholder record with status 'PROCESSING'
        db.create_pending_invoice(invoice_id, storage_url)
        
        # 4. Dispatch processing task to active messaging provider (e.g. GCP Pub/Sub or Dummy)
        task_payload = {
            "id": invoice_id,
            "gcs_url": storage_url
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

class ProcessingCallbackRequest(BaseModel):
    status: str  # "COMPLETED" or "ERROR"
    data: dict

@app.post("/api/invoices/{invoice_id}/callback")
async def processing_callback(invoice_id: str, req: ProcessingCallbackRequest):
    """Callback endpoint for the worker to notify API service of completion"""
    try:
        # Broadcast the processing finish status to connected websocket clients
        await notification_service.notify_processing_finished(invoice_id, req.status, req.data)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to handle processing callback: {str(e)}"
        )

@app.get("/")
async def root():
    return {"message": "Slip Vault API Service (Uploader) is running."}
