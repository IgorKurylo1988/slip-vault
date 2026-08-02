from pydantic import BaseModel, Field
from typing import List, Optional

class ProcessInvoiceRequest(BaseModel):
    image: str  # Base64 string of the processed grayscale image
    id: Optional[str] = None  # Client-supplied unique invoice identifier for notifications
    userId: Optional[str] = None  # Multi-tenant user identifier

class InvoiceItem(BaseModel):
    sku: Optional[str] = Field(default=None, description="The SKU or catalog/MKT number of the item.")
    name: str = Field(description="The name of the item.")
    quantity: float = Field(description="The quantity of the item.")
    price: float = Field(description="The unit price of the item.")

class InvoiceData(BaseModel):
    # This class is used by LiteLLM for structured extraction
    storeName: str = Field(description="The merchant or shop name.")
    storeAddress: Optional[str] = Field(default=None, description="The full address of the shop if visible.")
    date: str = Field(description="The date of the receipt in YYYY-MM-DD format.")
    time: Optional[str] = Field(default=None, description="The time of the receipt in HH:MM format.")
    invoiceNumber: str = Field(description="The document number or ID (Invoice #, receipt #, Asmachta, Heshbonit).")
    type: str = Field(description="Categorization: 'INVOICE' | 'CREDIT_INVOICE' | 'RECEIPT' | 'INVALID'")
    currency: str = Field(default="₪", description="Currency symbol (₪, $, €, etc.)")
    items: List[InvoiceItem] = Field(default_factory=list, description="List of items on the receipt.")
    subtotal: Optional[float] = Field(default=None, description="Subtotal amount before tax/VAT.")
    tax: Optional[float] = Field(default=None, description="VAT or tax amount.")
    totalAmount: float = Field(description="Total amount of the receipt.")
    rejectionReason: Optional[str] = Field(default=None, description="Detailed explanation if document type is INVALID.")

# UserAuthSchema removed. Use common.models.user.UserAuthSchema instead.

