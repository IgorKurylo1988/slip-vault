import os
import sys
import uuid
import asyncio
import datetime
from typing import List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware

# Ensure both parent 'backend' and current 'api_service' folders are in sys.path for clean static imports
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Standard Static FastAPI Imports
from common import db
from common.storage import get_storage_provider
from common.messaging import get_messaging_provider
from common.auth_utils import (
    hash_password, verify_password, create_jwt_token, 
    decode_jwt_token, create_reset_token, verify_reset_token
)
from common.email_service import send_password_reset_email
from common.schemas import ProcessInvoiceRequest
from common.models.invoice import InvoiceModel
from common.models.user import UserAuthSchema, UserRegisterSchema, ForgotPasswordSchema, ResetPasswordSchema
from common.repository.user import UserRepository
from common.repository.invoice import InvoiceRepository
from routes.admin import admin_routes

# Load local environment variables
load_dotenv(os.path.join(parent_dir, ".env"))

# Initialize Database Client
db.init_db()

user_repo = UserRepository()
invoice_repo = InvoiceRepository()

app = FastAPI(title="Slip Vault API (Uploader/API Service)", version="1.0.0")

origins = [
    "https://slip-vault.com",
    "https://www.slip-vault.com",
    "https://api.slip-vault.com",
    "https://notifications.slip-vault.com",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:8001",
]

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_routes)

async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """Validates JWT token and extracts the userId (sub)"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token"
        )
    token = authorization.split(" ")[1]
    payload = decode_jwt_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token or token expired"
        )
    return payload["sub"]

# =====================================================================
# Auth Endpoints
# =====================================================================
@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
async def register_user(req: UserRegisterSchema):
    existing = user_repo.get_by_email(req.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    pwd_hash = hash_password(req.password)
    user_id = str(uuid.uuid4())[:8]
    user_repo.create(
        user_id=user_id,
        email=req.email,
        password_hash=pwd_hash,
        first_name=req.firstName or "",
        last_name=req.lastName or ""
    )
    
    token = create_jwt_token(user_id, req.email)
    return {
        "status": "success",
        "userId": user_id,
        "email": req.email,
        "firstName": req.firstName or "",
        "lastName": req.lastName or "",
        "token": token
    }

@app.post("/api/auth/login")
async def login_user(req: UserAuthSchema):
    user = user_repo.get_by_email(req.email)
    if not user or not verify_password(req.password, user.get("passwordHash")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    token = create_jwt_token(user["id"], user["email"])
    return {
        "status": "success",
        "userId": user["id"],
        "email": user["email"],
        "firstName": user.get("firstName", ""),
        "lastName": user.get("lastName", ""),
        "token": token
    }

@app.post("/api/auth/forgot-password")
async def forgot_password(req: ForgotPasswordSchema, request: Request):
    user = user_repo.get_by_email(req.email)
    if user:
        reset_token = create_reset_token(user["id"], user["email"])
        origin = request.headers.get("origin") or "http://localhost:3000"
        reset_url = f"{origin}/#/reset-password?token={reset_token}"
        send_password_reset_email(user["email"], reset_url)
    
    return {
        "status": "success",
        "message": "If that email address is registered, a password reset link has been sent."
    }

@app.post("/api/auth/reset-password")
async def reset_password(req: ResetPasswordSchema):
    payload = verify_reset_token(req.token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token."
        )
    
    user_id = payload["sub"]
    pwd_hash = hash_password(req.newPassword)
    
    user_repo.collection.document(user_id).update({"passwordHash": pwd_hash})
    
    return {
        "status": "success",
        "message": "Password successfully updated. You may now log in with your new password."
    }

# =====================================================================
# Invoices Endpoints (Authenticated)
# =====================================================================
@app.get("/api/invoices", response_model=List[InvoiceModel])
async def get_invoices(current_user: str = Depends(get_current_user)):
    try:
        invoices = invoice_repo.get_all_completed(current_user)
        for inv in invoices:
            if inv.get("scannedImage"):
                inv["scannedImage"] = get_storage_provider().get_signed_url(inv["scannedImage"])
        return invoices
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query error: {str(e)}"
        )

@app.get("/api/invoices/{invoice_id}", response_model=InvoiceModel)
async def get_invoice_by_id(invoice_id: str, current_user: str = Depends(get_current_user)):
    inv = invoice_repo.get_by_id(invoice_id)
    if not inv or inv.get("userId") != current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    if inv.get("scannedImage"):
        inv["scannedImage"] = get_storage_provider().get_signed_url(inv["scannedImage"])
    return inv

@app.post("/api/invoices", response_model=InvoiceModel, status_code=status.HTTP_202_ACCEPTED)
async def upload_invoice(req: ProcessInvoiceRequest, current_user: str = Depends(get_current_user)):
    invoice_id = str(uuid.uuid4())[:8]
    
    stored_path = get_storage_provider().save_bytes(
        file_bytes=req.image_bytes,
        user_id=current_user,
        invoice_id=invoice_id
    )

    created_at = int(datetime.datetime.now().timestamp() * 1000)

    initial_invoice = {
        "id": invoice_id,
        "userId": current_user,
        "storeName": "Processing...",
        "totalAmount": 0.0,
        "date": datetime.datetime.now().strftime("%Y-%m-%d"),
        "time": "",
        "items": [],
        "scannedImage": stored_path,
        "status": "PROCESSING",
        "createdAt": created_at,
        "currency": "₪",
        "type": "INVOICE"
    }

    invoice_repo.save(initial_invoice)

    get_messaging_provider().publish_task({
        "invoice_id": invoice_id,
        "user_id": current_user,
        "image_path": stored_path
    })

    initial_invoice["scannedImage"] = get_storage_provider().get_signed_url(stored_path)
    return initial_invoice

@app.delete("/api/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, current_user: str = Depends(get_current_user)):
    inv = invoice_repo.get_by_id(invoice_id)
    if not inv or inv.get("userId") != current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    invoice_repo.delete(invoice_id)
    return {"status": "success", "message": f"Deleted invoice {invoice_id}"}
