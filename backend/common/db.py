import os
import json
import logging

logger = logging.getLogger("db")

_firestore_client = None

def get_firestore_client():
    global _firestore_client
    if _firestore_client is None:
        from google.cloud import firestore
        # Resolves credentials from default GCP environment or emulator
        _firestore_client = firestore.Client()
    return _firestore_client

# =====================================================================
# Public Interface (Firestore Only)
# =====================================================================
def init_db():
    logger.info("Database provider: FIRESTORE (Collections are initialized dynamically)")

def create_pending_invoice(invoice_id: str, scanned_image_url: str):
    """Inserts a placeholder invoice row with status 'PROCESSING'"""
    try:
        client = get_firestore_client()
        doc_ref = client.collection("invoices").document(invoice_id)
        doc_ref.set({
            "id": invoice_id,
            "scannedImage": scanned_image_url,
            "status": "PROCESSING"
        })
    except Exception as e:
        logger.error(f"Firestore create_pending_invoice failed: {e}")
        raise e

def get_invoice_by_id(invoice_id: str):
    try:
        client = get_firestore_client()
        doc = client.collection("invoices").document(invoice_id).get()
        if doc.exists:
            inv = doc.to_dict()
            return inv
        return None
    except Exception as e:
        logger.error(f"Firestore get_invoice_by_id failed: {e}")
        raise e

def get_all_invoices():
    """Returns only finalized (COMPLETED) invoices"""
    try:
        client = get_firestore_client()
        docs = client.collection("invoices").where("status", "==", "COMPLETED").stream()
        results = [doc.to_dict() for doc in docs]
        # Sort locally to avoid custom index generation overhead on GCP
        results.sort(key=lambda x: x.get("createdAt", 0), reverse=True)
        return results
    except Exception as e:
        logger.error(f"Firestore get_all_invoices failed: {e}")
        raise e

def save_invoice(invoice: dict):
    """Updates/Finalizes the invoice details (user edits or edits manually)"""
    try:
        client = get_firestore_client()
        doc_ref = client.collection("invoices").document(invoice["id"])
        doc_ref.set({
            **invoice,
            "status": "COMPLETED"
        }, merge=True)
    except Exception as e:
        logger.error(f"Firestore save_invoice failed: {e}")
        raise e

def delete_invoice(invoice_id: str):
    try:
        client = get_firestore_client()
        client.collection("invoices").document(invoice_id).delete()
    except Exception as e:
        logger.error(f"Firestore delete_invoice failed: {e}")
        raise e

def update_invoice_success(invoice_id: str, metadata: dict):
    """Updates the invoice row with extracted LLM details and marks status as COMPLETED"""
    try:
        import time
        created_at = metadata.get("createdAt") or int(time.time() * 1000)
        client = get_firestore_client()
        doc_ref = client.collection("invoices").document(invoice_id)
        
        update_data = {
            **metadata,
            "createdAt": created_at,
            "status": "COMPLETED",
            "rejectionReason": None
        }
        doc_ref.set(update_data, merge=True)
    except Exception as e:
        logger.error(f"Firestore update_invoice_success failed: {e}")
        raise e

def update_invoice_error(invoice_id: str, rejection_reason: str):
    """Marks the invoice status as ERROR and writes the rejection reason"""
    try:
        client = get_firestore_client()
        doc_ref = client.collection("invoices").document(invoice_id)
        doc_ref.set({
            "status": "ERROR",
            "rejectionReason": rejection_reason
        }, merge=True)
    except Exception as e:
        logger.error(f"Firestore update_invoice_error failed: {e}")
        raise e
