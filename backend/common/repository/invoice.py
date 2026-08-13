import logging
import time
from typing import Optional, List
from google.cloud.firestore_v1.base_query import FieldFilter
from common.db import get_firestore_client
from common.models.invoice import InvoiceModel

logger = logging.getLogger("repository.invoice")

class InvoiceRepository:
    def __init__(self):
        self.client = get_firestore_client()
        self.collection = self.client.collection("invoices")

    def create_pending(self, invoice_id: str, scanned_image_url: str, user_id: str):
        try:
            doc_ref = self.collection.document(invoice_id)
            doc_ref.set({
                "id": invoice_id,
                "scannedImage": scanned_image_url,
                "status": "PROCESSING",
                "userId": user_id
            })
        except Exception as e:
            logger.error(f"Failed to create pending invoice: {e}")
            raise e

    def get_by_id(self, invoice_id: str) -> Optional[dict]:
        try:
            doc = self.collection.document(invoice_id).get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Failed to get invoice {invoice_id}: {e}")
            raise e

    def get_all_completed(self, user_id: str) -> List[dict]:
        try:
            docs = self.collection\
                .where(filter=FieldFilter("userId", "==", user_id))\
                .where(filter=FieldFilter("status", "==", "COMPLETED"))\
                .stream()
            results = [doc.to_dict() for doc in docs]
            results.sort(key=lambda x: x.get("createdAt", 0), reverse=True)
            return results
        except Exception as e:
            logger.error(f"Failed to get all invoices for user {user_id}: {e}")
            raise e

    def get_all_system_invoices(self) -> List[dict]:
        try:
            docs = self.collection.stream()
            results = [doc.to_dict() for doc in docs if doc.to_dict().get("status") == "COMPLETED"]
            results.sort(key=lambda x: x.get("createdAt", 0), reverse=True)
            return results
        except Exception as e:
            logger.error(f"Failed to get all system invoices: {e}")
            raise e

    def save(self, invoice_dict: dict):
        try:
            doc_ref = self.collection.document(invoice_dict["id"])
            doc_ref.set({
                **invoice_dict,
                "status": "COMPLETED"
            }, merge=True)
        except Exception as e:
            logger.error(f"Failed to save invoice: {e}")
            raise e

    def delete(self, invoice_id: str):
        try:
            self.collection.document(invoice_id).delete()
        except Exception as e:
            logger.error(f"Failed to delete invoice {invoice_id}: {e}")
            raise e

    def update_success(self, invoice_id: str, metadata: dict):
        try:
            created_at = metadata.get("createdAt") or int(time.time() * 1000)
            doc_ref = self.collection.document(invoice_id)
            doc_ref.set({
                **metadata,
                "createdAt": created_at,
                "status": "COMPLETED",
                "rejectionReason": None
            }, merge=True)
        except Exception as e:
            logger.error(f"Failed to update invoice success: {e}")
            raise e

    def update_error(self, invoice_id: str, rejection_reason: str):
        try:
            doc_ref = self.collection.document(invoice_id)
            doc_ref.set({
                "status": "ERROR",
                "rejectionReason": rejection_reason
              }, merge=True)
        except Exception as e:
            logger.error(f"Failed to update invoice error: {e}")
            raise e
