import time
import json
import os
import sys
import logging
import urllib.request
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response, status

# Add the parent backend folder to sys.path to allow importing from the common folder
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import shared modules and drivers from common package
from common import db, llm
from common.messaging import get_messaging_provider

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("worker")

# Load local environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

NOTIFICATION_CALLBACK_URL = os.getenv("NOTIFICATION_CALLBACK_URL", "http://notification_service:8001")

# Initialize FastAPI App to handle Pub/Sub Push Subscriptions on Cloud Run
app = FastAPI(title="Slip Vault Processor Agent Task Handler")

def send_callback(invoice_id: str, status: str, data: dict):
    url = f"{NOTIFICATION_CALLBACK_URL}/api/invoices/{invoice_id}/callback"
    payload = {
        "status": status,
        "data": data
    }
    logger.info(f"Sending callback for {invoice_id} with status {status} to {url}")
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            response.read()
    except Exception as e:
        logger.error(f"Failed to send callback for invoice {invoice_id}: {e}")

def run_agentic_task(invoice_id: str, gcs_url: str, user_id: str, timestamp_str: str):
    logger.info(f"Processing invoice task {invoice_id} for user {user_id} from URL: {gcs_url}")
    try:
        # 1. Call LiteLLM interface to process the image
        metadata = llm.process_invoice_image(gcs_url)
        
        # 2. Check receipt rules
        if metadata.get("type") == "INVALID":
            rejection = metadata.get("rejectionReason") or "This document is not a refundable receipt (Credit Note)."
            logger.warning(f"Invoice {invoice_id} is INVALID: {rejection}")
            db.update_invoice_error(invoice_id, rejection)
            send_callback(invoice_id, "ERROR", {"error": rejection})
        elif not metadata.get("totalAmount") or metadata["totalAmount"] <= 0:
            rejection = "Could not find a valid total amount on this receipt."
            logger.warning(f"Invoice {invoice_id} total amount invalid: {metadata.get('totalAmount')}")
            db.update_invoice_error(invoice_id, rejection)
            send_callback(invoice_id, "ERROR", {"error": rejection})
        else:
            # Clean/slugify storeName for file path
            store_name = metadata.get("storeName") or "unknown_store"
            import re
            clean_store_name = re.sub(r'[^a-zA-Z0-9_\-]', '', store_name.replace(' ', '_')).lower()
            if not clean_store_name:
                clean_store_name = "unknown_store"

            # 3. Rename GCS blob to /userid/dd-mm-yyyy-timestamp/store-name/invoice_id.jpg
            from common.storage import get_storage_provider
            new_gcs_url = get_storage_provider().rename_image(
                old_url=gcs_url,
                new_user_id=user_id,
                new_timestamp=timestamp_str,
                new_store_name=clean_store_name,
                file_name=invoice_id
            )
            metadata["scannedImage"] = new_gcs_url

            # Success: save extracted metadata to DB and mark status as COMPLETED
            logger.info(f"Invoice {invoice_id} successfully parsed and stored under clean path. Saving to DB.")
            db.update_invoice_success(invoice_id, metadata)
            row = db.get_invoice_by_id(invoice_id)
            send_callback(invoice_id, "COMPLETED", row or metadata)

    except Exception as ex:
        # Update status to ERROR in SQLite database
        error_msg = f"Processing error: {str(ex)}"
        logger.error(f"Error processing invoice {invoice_id}: {error_msg}")
        db.update_invoice_error(invoice_id, error_msg)
        send_callback(invoice_id, "ERROR", {"error": error_msg})

@app.post("/api/process-task")
async def process_task(request: Request):
    """Exposes HTTP Endpoint for Pub/Sub Push Subscriptions on GCP Cloud Run"""
    try:
        body = await request.json()
        logger.info(f"Received Pub/Sub push task payload: {body}")
        
        msg = body.get("message", {})
        data_base64 = msg.get("data")
        if not data_base64:
            return Response(status_code=status.HTTP_400_BAD_REQUEST, content="Missing message data")
            
        import base64
        decoded_bytes = base64.b64decode(data_base64)
        task_body = json.loads(decoded_bytes.decode("utf-8"))
        
        invoice_id = task_body.get("id")
        gcs_url = task_body.get("gcs_url")
        user_id = task_body.get("userId", "default_user")
        timestamp_str = task_body.get("timestamp_str", "temp")
        
        if not invoice_id or not gcs_url:
            return Response(status_code=status.HTTP_400_BAD_REQUEST, content="Invalid message task data")
            
        # Run processing task synchronously
        run_agentic_task(invoice_id, gcs_url, user_id, timestamp_str)
        return {"status": "success", "message": "Task processed successfully"}
        
    except Exception as e:
        logger.error(f"Error handling push task: {e}")
        return Response(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=str(e))

@app.get("/")
async def root():
    return {"message": "Slip Vault Processor Agent Invoice is running."}

def poll_queue():
    messaging_provider = get_messaging_provider()
    logger.info(f"Starting worker daemon polling using messaging provider: {messaging_provider.__class__.__name__}")

    while True:
        try:
            tasks = messaging_provider.receive_messages(wait_time_seconds=10)
            if not tasks:
                continue

            for task in tasks:
                receipt_handle = task["receipt_handle"]
                body = task["body"]

                invoice_id = body.get("id")
                gcs_url = body.get("gcs_url")
                user_id = body.get("userId", "default_user")
                timestamp_str = body.get("timestamp_str", "temp")

                if not invoice_id or not gcs_url:
                    logger.warning(f"Invalid message format received: {body}. Deleting message.")
                    messaging_provider.delete_message(receipt_handle)
                    continue

                run_agentic_task(invoice_id, gcs_url, user_id, timestamp_str)
                messaging_provider.delete_message(receipt_handle)
                logger.info(f"Deleted/Acknowledged task message for invoice {invoice_id}.")

        except Exception as e:
            logger.error(f"Worker polling loop error: {str(e)}")
            time.sleep(5)

if __name__ == "__main__":
    port = os.getenv("PORT")
    if port:
        import uvicorn
        logger.info(f"Starting worker as HTTP Server on port {port}...")
        uvicorn.run("worker:app", host="0.0.0.0", port=int(port))
    else:
        poll_queue()
