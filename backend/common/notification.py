import logging
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger("notification")

class NotificationService:
    def __init__(self):
        # Map of invoice_id -> list of active WebSockets listening for updates on this invoice
        self.listeners: Dict[str, List[WebSocket]] = {}

    async def register(self, invoice_id: str, websocket: WebSocket):
        """Accepts a WebSocket connection and registers it as a listener for a specific invoice"""
        await websocket.accept()
        if invoice_id not in self.listeners:
            self.listeners[invoice_id] = []
        self.listeners[invoice_id].append(websocket)
        logger.info(f"WebSocket client registered for invoice: {invoice_id}")

    def unregister(self, invoice_id: str, websocket: WebSocket):
        """Cleans up disconnected WebSockets from the listener registry"""
        if invoice_id in self.listeners:
            if websocket in self.listeners[invoice_id]:
                self.listeners[invoice_id].remove(websocket)
            if not self.listeners[invoice_id]:
                del self.listeners[invoice_id]
        logger.info(f"WebSocket client unregistered for invoice: {invoice_id}")

    async def notify_processing_finished(self, invoice_id: str, status: str, data: dict = None):
        """
        Pushes a real-time JSON notification payload to all WebSocket clients 
        subscribed to the given invoice ID when processing completes or fails.
        """
        if invoice_id in self.listeners:
            payload = {
                "event": "processing_finished",
                "invoice_id": invoice_id,
                "status": status,
                "data": data
            }
            logger.info(f"Dispatching WebSocket notification for invoice {invoice_id} with status: {status}")
            
            # Use list copy to safely remove disconnected sockets during iteration
            for websocket in list(self.listeners[invoice_id]):
                try:
                    await websocket.send_json(payload)
                except Exception as e:
                    logger.warning(f"Failed to push message, removing socket for invoice {invoice_id}: {str(e)}")
                    self.unregister(invoice_id, websocket)

# Global singleton instance
notification_service = NotificationService()
