import os
import sys
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add the parent backend folder to sys.path to allow importing from the common folder
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.notification import notification_service

app = FastAPI(title="Slip Vault Notification Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProcessingCallbackRequest(BaseModel):
    status: str  # "COMPLETED" or "ERROR"
    data: dict

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

@app.post("/api/invoices/{invoice_id}/callback")
async def processing_callback(invoice_id: str, req: ProcessingCallbackRequest):
    """Callback endpoint for the worker to notify WebSocket clients of completion"""
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
    return {"message": "Slip Vault Notification Service is running."}
