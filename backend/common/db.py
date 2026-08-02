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

# Database collections are managed via repositories in api_service.repository

