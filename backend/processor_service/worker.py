import time
import json
import os
import sys
import logging
import urllib.request
from dotenv import load_dotenv

# Add the parent backend folder to sys.path to allow importing from the common folder
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import shared modules and drivers from common package
from common import db, llm
from common.messaging import get_messaging_provider

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("worker")

# Load local environment variables (resolves to backend/.env if run from backend/)
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

NOTIFICATION_CALLBACK_URL = os.getenv("NOTIFICATION_CALLBACK_URL", "http://notification_service:8001")

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

def poll_queue():
    messaging_provider = get_messaging_provider()
    logger.info(f"Starting worker daemon using messaging provider: {messaging_provider.__class__.__name__}")

    while True:
        try:
            # Poll the queue/subscription for tasks (long polling where supported)
            tasks = messaging_provider.receive_messages(wait_time_seconds=10)
            if not tasks:
                continue

            for task in tasks:
                receipt_handle = task["receipt_handle"]
                body = task["body"]

                invoice_id = body.get("id")
                gcs_url = body.get("gcs_url")

                if not invoice_id or not gcs_url:
                    logger.warning(f"Invalid message format received: {body}. Deleting message.")
                    messaging_provider.delete_message(receipt_handle)
                    continue

                logger.info(f"Processing invoice task {invoice_id} from URL: {gcs_url}")

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
                        # Success: save extracted metadata to DB and mark status as COMPLETED
                        logger.info(f"Invoice {invoice_id} successfully parsed. Saving to DB.")
                        db.update_invoice_success(invoice_id, metadata)
                        row = db.get_invoice_by_id(invoice_id)
                        send_callback(invoice_id, "COMPLETED", row or metadata)

                except Exception as ex:
                    # Update status to ERROR in SQLite database
                    error_msg = f"Processing error: {str(ex)}"
                    logger.error(f"Error processing invoice {invoice_id}: {error_msg}")
                    db.update_invoice_error(invoice_id, error_msg)
                    send_callback(invoice_id, "ERROR", {"error": error_msg})

                finally:
                    # Delete/Acknowledge message from SQS or GCP Pub/Sub to avoid duplicate processing
                    messaging_provider.delete_message(receipt_handle)
                    logger.info(f"Deleted/Acknowledged task message for invoice {invoice_id}.")

        except Exception as e:
            logger.error(f"Worker polling loop error: {str(e)}")
            time.sleep(5)  # Wait a bit before retrying in case of network drops

if __name__ == "__main__":
    poll_queue()
