from pydantic import BaseModel
from typing import List, Optional
from common.schemas import InvoiceItem

class InvoiceModel(BaseModel):
    id: Optional[str] = None
    createdAt: Optional[int] = None
    storeName: Optional[str] = None
    storeAddress: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    invoiceNumber: Optional[str] = None
    type: Optional[str] = None
    currency: Optional[str] = None
    items: List[InvoiceItem] = []
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    totalAmount: Optional[float] = None
    confidenceScore: Optional[float] = None
    scannedImage: Optional[str] = None
    status: Optional[str] = None
    rejectionReason: Optional[str] = None
    userId: Optional[str] = None
