import time
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Header, Depends

from common.storage import get_storage_provider
from common.auth_utils import decode_jwt_token, is_admin_email, get_user_role
from common.models.invoice import InvoiceModel
from common.repository.user import UserRepository
from common.repository.invoice import InvoiceRepository

user_repo = UserRepository()
invoice_repo = InvoiceRepository()

router = APIRouter(prefix="/api/admin", tags=["admin"])

async def get_admin_user(authorization: Optional[str] = Header(None)) -> dict:
    """Validates JWT token and verifies admin authorization"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token"
        )
    token = authorization.split(" ")[1]
    payload = decode_jwt_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token or token expired"
        )
    email = payload.get("email", "")
    if not is_admin_email(email) and payload.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required to execute this management action."
        )
    return payload

@router.get("/invoices", response_model=List[InvoiceModel])
async def get_admin_invoices(admin_payload: dict = Depends(get_admin_user)):
    try:
        invoices = invoice_repo.get_all_system_invoices()
        for inv in invoices:
            if inv.get("scannedImage"):
                inv["scannedImage"] = get_storage_provider().get_signed_url(inv["scannedImage"])
        return invoices
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@router.delete("/invoices/{invoice_id}")
async def delete_admin_invoice(invoice_id: str, admin_payload: dict = Depends(get_admin_user)):
    try:
        inv = invoice_repo.get_by_id(invoice_id)
        if not inv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invoice not found in system database."
            )
        invoice_repo.delete(invoice_id)
        return {"status": "success", "message": f"Admin deleted invoice {invoice_id} system-wide."}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete invoice: {str(e)}"
        )

@router.get("/users")
async def get_admin_users(admin_payload: dict = Depends(get_admin_user)):
    try:
        users = user_repo.get_all()
        all_invoices = invoice_repo.get_all_system_invoices()
        
        user_stats = {}
        for inv in all_invoices:
            uid = inv.get("userId", "unknown")
            if uid not in user_stats:
                user_stats[uid] = {"count": 0, "spend": 0.0, "credits": 0.0}
            user_stats[uid]["count"] += 1
            if inv.get("type") == "CREDIT_INVOICE":
                user_stats[uid]["credits"] += abs(inv.get("totalAmount", 0.0))
            else:
                user_stats[uid]["spend"] += abs(inv.get("totalAmount", 0.0))

        result = []
        known_user_ids = set()
        for u in users:
            uid = u.get("id")
            if uid:
                known_user_ids.add(uid)
            email = u.get("email", "")
            stats = user_stats.get(uid, {"count": 0, "spend": 0.0, "credits": 0.0})
            result.append({
                "id": uid,
                "email": email,
                "role": get_user_role(email),
                "firstName": u.get("firstName", ""),
                "lastName": u.get("lastName", ""),
                "createdAt": u.get("createdAt", 0),
                "uploadedPicturesCount": stats["count"],
                "totalSpend": stats["spend"],
                "totalCredits": stats["credits"]
            })

        # Include user IDs found in receipts that may not have explicit user profile records
        for uid, stats in user_stats.items():
            if uid and uid not in known_user_ids and uid != "unknown":
                synthetic_email = f"{uid}@slip-vault.com"
                result.append({
                    "id": uid,
                    "email": synthetic_email,
                    "role": get_user_role(synthetic_email),
                    "firstName": "Active",
                    "lastName": "User",
                    "createdAt": 0,
                    "uploadedPicturesCount": stats["count"],
                    "totalSpend": stats["spend"],
                    "totalCredits": stats["credits"]
                })
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error listing users: {str(e)}"
        )

@router.get("/users/{user_id}/export")
async def export_user_data(user_id: str, admin_payload: dict = Depends(get_admin_user)):
    try:
        invoices = invoice_repo.get_all_completed(user_id)
        for inv in invoices:
            if inv.get("scannedImage"):
                inv["scannedImage"] = get_storage_provider().get_signed_url(inv["scannedImage"])
        return {
            "userId": user_id,
            "exportedAt": int(time.time() * 1000),
            "totalDocuments": len(invoices),
            "invoices": invoices
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export user data: {str(e)}"
        )

@router.delete("/users/{user_id}")
async def delete_admin_user_data(user_id: str, admin_payload: dict = Depends(get_admin_user)):
    try:
        invoice_repo.delete_all_for_user(user_id)
        user_repo.delete(user_id)
        return {"status": "success", "message": f"Successfully deleted all data and account for user {user_id}."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user data: {str(e)}"
        )
