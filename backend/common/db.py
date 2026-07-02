import os
import json
import sqlite3
import logging

logger = logging.getLogger("db")

DB_PROVIDER = os.getenv("DATABASE_PROVIDER", "SQLITE").upper()
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "invoices.db")

_firestore_client = None

def get_firestore_client():
    global _firestore_client
    if _firestore_client is None:
        from google.cloud import firestore
        # Resolves credentials from default GCP environment or emulator
        _firestore_client = firestore.Client()
    return _firestore_client

# =====================================================================
# SQLite Implementation
# =====================================================================
def _sqlite_get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _sqlite_init():
    conn = _sqlite_get_conn()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                createdAt INTEGER,
                storeName TEXT,
                storeAddress TEXT,
                date TEXT,
                time TEXT,
                invoiceNumber TEXT,
                type TEXT,
                currency TEXT,
                items TEXT,
                subtotal REAL,
                tax REAL,
                totalAmount REAL,
                confidenceScore REAL,
                scannedImage TEXT,
                status TEXT NOT NULL DEFAULT 'COMPLETED',
                rejectionReason TEXT
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_invoices_createdAt ON invoices(createdAt)")
        conn.commit()
    finally:
        conn.close()

# =====================================================================
# Public Interface
# =====================================================================
def init_db():
    if DB_PROVIDER == "FIRESTORE":
        logger.info("Database provider: FIRESTORE (Collections are initialized dynamically)")
    else:
        logger.info("Database provider: SQLITE")
        _sqlite_init()

def create_pending_invoice(invoice_id: str, scanned_image_url: str):
    """Inserts a placeholder invoice row with status 'PROCESSING'"""
    if DB_PROVIDER == "FIRESTORE":
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
    else:
        conn = _sqlite_get_conn()
        try:
            conn.execute("""
                INSERT INTO invoices (id, scannedImage, status)
                VALUES (?, ?, 'PROCESSING')
            """, (invoice_id, scanned_image_url))
            conn.commit()
        finally:
            conn.close()

def get_invoice_by_id(invoice_id: str):
    if DB_PROVIDER == "FIRESTORE":
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
    else:
        conn = _sqlite_get_conn()
        try:
            cursor = conn.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,))
            row = cursor.fetchone()
            if row:
                inv = dict(row)
                inv["items"] = json.loads(inv["items"]) if inv.get("items") else []
                return inv
            return None
        finally:
            conn.close()

def get_all_invoices():
    """Returns only finalized (COMPLETED) invoices"""
    if DB_PROVIDER == "FIRESTORE":
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
    else:
        conn = _sqlite_get_conn()
        try:
            cursor = conn.execute("SELECT * FROM invoices WHERE status = 'COMPLETED' ORDER BY createdAt DESC")
            rows = cursor.fetchall()
            invoices = []
            for r in rows:
                inv = dict(r)
                inv["items"] = json.loads(inv["items"]) if inv.get("items") else []
                invoices.append(inv)
            return invoices
        finally:
            conn.close()

def save_invoice(invoice: dict):
    """Updates/Finalizes the invoice details (user edits or edits manually)"""
    if DB_PROVIDER == "FIRESTORE":
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
    else:
        conn = _sqlite_get_conn()
        try:
            conn.execute("""
                INSERT INTO invoices (
                    id, createdAt, storeName, storeAddress, date, time, 
                    invoiceNumber, type, currency, items, subtotal, tax, 
                    totalAmount, confidenceScore, scannedImage, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
                ON CONFLICT(id) DO UPDATE SET
                    createdAt=excluded.createdAt,
                    storeName=excluded.storeName,
                    storeAddress=excluded.storeAddress,
                    date=excluded.date,
                    time=excluded.time,
                    invoiceNumber=excluded.invoiceNumber,
                    type=excluded.type,
                    currency=excluded.currency,
                    items=excluded.items,
                    subtotal=excluded.subtotal,
                    tax=excluded.tax,
                    totalAmount=excluded.totalAmount,
                    confidenceScore=excluded.confidenceScore,
                    scannedImage=COALESCE(excluded.scannedImage, invoices.scannedImage),
                    status='COMPLETED'
            """, (
                invoice["id"],
                invoice.get("createdAt"),
                invoice.get("storeName"),
                invoice.get("storeAddress"),
                invoice.get("date"),
                invoice.get("time"),
                invoice.get("invoiceNumber"),
                invoice.get("type"),
                invoice.get("currency"),
                json.dumps(invoice.get("items", [])),
                invoice.get("subtotal"),
                invoice.get("tax"),
                invoice.get("totalAmount"),
                invoice.get("confidenceScore"),
                invoice.get("scannedImage")
            ))
            conn.commit()
        finally:
            conn.close()

def delete_invoice(invoice_id: str):
    if DB_PROVIDER == "FIRESTORE":
        try:
            client = get_firestore_client()
            client.collection("invoices").document(invoice_id).delete()
        except Exception as e:
            logger.error(f"Firestore delete_invoice failed: {e}")
            raise e
    else:
        conn = _sqlite_get_conn()
        try:
            conn.execute("DELETE FROM invoices WHERE id = ?", (invoice_id,))
            conn.commit()
        finally:
            conn.close()

def update_invoice_success(invoice_id: str, metadata: dict):
    """Updates the invoice row with extracted LLM details and marks status as COMPLETED"""
    if DB_PROVIDER == "FIRESTORE":
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
    else:
        conn = _sqlite_get_conn()
        try:
            import time
            created_at = metadata.get("createdAt") or int(time.time() * 1000)
            scanned_image = metadata.get("scannedImage")
            
            if scanned_image:
                conn.execute("""
                    UPDATE invoices SET
                        createdAt = ?,
                        storeName = ?,
                        storeAddress = ?,
                        date = ?,
                        time = ?,
                        invoiceNumber = ?,
                        type = ?,
                        currency = ?,
                        items = ?,
                        subtotal = ?,
                        tax = ?,
                        totalAmount = ?,
                        confidenceScore = ?,
                        scannedImage = ?,
                        status = 'COMPLETED',
                        rejectionReason = NULL
                    WHERE id = ?
                """, (
                    created_at,
                    metadata.get("storeName"),
                    metadata.get("storeAddress"),
                    metadata.get("date"),
                    metadata.get("time"),
                    metadata.get("invoiceNumber"),
                    metadata.get("type"),
                    metadata.get("currency"),
                    json.dumps(metadata.get("items", [])),
                    metadata.get("subtotal"),
                    metadata.get("tax"),
                    metadata.get("totalAmount"),
                    metadata.get("confidenceScore"),
                    scanned_image,
                    invoice_id
                ))
            else:
                conn.execute("""
                    UPDATE invoices SET
                        createdAt = ?,
                        storeName = ?,
                        storeAddress = ?,
                        date = ?,
                        time = ?,
                        invoiceNumber = ?,
                        type = ?,
                        currency = ?,
                        items = ?,
                        subtotal = ?,
                        tax = ?,
                        totalAmount = ?,
                        confidenceScore = ?,
                        status = 'COMPLETED',
                        rejectionReason = NULL
                    WHERE id = ?
                """, (
                    created_at,
                    metadata.get("storeName"),
                    metadata.get("storeAddress"),
                    metadata.get("date"),
                    metadata.get("time"),
                    metadata.get("invoiceNumber"),
                    metadata.get("type"),
                    metadata.get("currency"),
                    json.dumps(metadata.get("items", [])),
                    metadata.get("subtotal"),
                    metadata.get("tax"),
                    metadata.get("totalAmount"),
                    metadata.get("confidenceScore"),
                    invoice_id
                ))
            conn.commit()
        finally:
            conn.close()

def update_invoice_error(invoice_id: str, rejection_reason: str):
    """Marks the invoice status as ERROR and writes the rejection reason"""
    if DB_PROVIDER == "FIRESTORE":
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
    else:
        conn = _sqlite_get_conn()
        try:
            conn.execute("""
                UPDATE invoices SET
                    status = 'ERROR',
                    rejectionReason = ?
                WHERE id = ?
            """, (rejection_reason, invoice_id))
            conn.commit()
        finally:
            conn.close()
