import os
import json
import logging
import time

logger = logging.getLogger("db")

_firestore_client = None

def get_firestore_client():
    global _firestore_client
    if _firestore_client is None:
        from google.cloud import firestore
        # Resolves credentials from default GCP environment or emulator
        db_name = os.getenv("FIRESTORE_DATABASE", "slip-vault")
        _firestore_client = firestore.Client(database=db_name)
    return _firestore_client

# =====================================================================
# Public Interface (Firestore Only)
# =====================================================================
def init_db():
    logger.info("Database provider: FIRESTORE (Collections are initialized dynamically)")

def create_pending_invoice(invoice_id: str, scanned_image_url: str, user_id: str = "default"):
    """Inserts a placeholder invoice row with status 'PROCESSING'"""
    try:
        client = get_firestore_client()
        doc_ref = client.collection("invoices").document(invoice_id)
        doc_ref.set({
            "id": invoice_id,
            "scannedImage": scanned_image_url,
            "status": "PROCESSING",
            "userId": user_id
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

def get_all_invoices(user_id: str):
    """Returns only finalized (COMPLETED) invoices for a specific user"""
    try:
        from google.cloud.firestore_v1.base_query import FieldFilter
        client = get_firestore_client()
        docs = client.collection("invoices")\
            .where(filter=FieldFilter("userId", "==", user_id))\
            .where(filter=FieldFilter("status", "==", "COMPLETED"))\
            .stream()
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

# =====================================================================
# User Authentication Helpers
# =====================================================================
def get_user_by_email(email: str):
    try:
        from google.cloud.firestore_v1.base_query import FieldFilter
        client = get_firestore_client()
        docs = client.collection("users").where(filter=FieldFilter("email", "==", email.lower().strip())).limit(1).stream()
        for doc in docs:
            return doc.to_dict()
        return None
    except Exception as e:
        logger.error(f"Firestore get_user_by_email failed: {e}")
        raise e

def create_user(user_id: str, email: str, password_hash: str):
    try:
        client = get_firestore_client()
        doc_ref = client.collection("users").document(user_id)
        doc_ref.set({
            "id": user_id,
            "email": email.lower().strip(),
            "passwordHash": password_hash,
            "createdAt": int(time.time() * 1000)
        })
        return user_id
    except Exception as e:
        logger.error(f"Firestore create_user failed: {e}")
        raise e
