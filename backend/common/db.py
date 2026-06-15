import sqlite3
import json
import os

# Database file is shared at the backend root level
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "invoices.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
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

def create_pending_invoice(invoice_id: str, scanned_image_url: str):
    """Inserts a placeholder invoice row with status 'PROCESSING'"""
    conn = get_db_connection()
    try:
        conn.execute("""
            INSERT INTO invoices (id, scannedImage, status)
            VALUES (?, ?, 'PROCESSING')
        """, (invoice_id, scanned_image_url))
        conn.commit()
    finally:
        conn.close()

def get_invoice_by_id(invoice_id: str):
    conn = get_db_connection()
    try:
        cursor = conn.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,))
        row = cursor.fetchone()
        if row:
            inv = dict(row)
            if inv.get("items"):
                inv["items"] = json.loads(inv["items"])
            else:
                inv["items"] = []
            return inv
        return None
    finally:
        conn.close()

def get_all_invoices():
    """Returns only finalized (COMPLETED) invoices"""
    conn = get_db_connection()
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
    """Updates/Finalizes the invoice details (used when the user edits and clicks save on the frontend)"""
    conn = get_db_connection()
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
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM invoices WHERE id = ?", (invoice_id,))
        conn.commit()
    finally:
        conn.close()

def update_invoice_success(invoice_id: str, metadata: dict):
    """Updates the invoice row with extracted LLM details and marks status as COMPLETED"""
    conn = get_db_connection()
    try:
        # Default to current time for sorting/createdAt if not specified
        created_at = metadata.get("createdAt") or int(os.times()[4] * 1000)
        
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
    conn = get_db_connection()
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
