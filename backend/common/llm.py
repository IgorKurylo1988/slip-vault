import os
import json
import base64
import litellm
import logging
from typing import List, Optional
from pydantic import BaseModel, Field

# Import storage helper
from .storage import get_storage_provider

logger = logging.getLogger("llm")

# Enable verbose logging for debugging LiteLLM calls if needed
# litellm.set_verbose = True

class InvoiceItem(BaseModel):
    sku: Optional[str] = Field(default=None, description="The SKU or catalog/MKT number of the item.")
    name: str = Field(description="The name of the item.")
    quantity: float = Field(description="The quantity of the item.")
    price: float = Field(description="The unit price of the item.")

class InvoiceData(BaseModel):
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

PROMPT = """
Analyze this scanned document image. This application ONLY accepts credit notes, refund receipts, or documents indicating a return of funds (Refundable Receipts).

CRITICAL CATEGORIZATION RULES (Multi-lingual support required):
- Classify as 'CREDIT_INVOICE' if the document contains any of these terms: 
  "Credit Note", "Refund", "Return", "זיכוי" (Zikui), "החזר" (Hechzer), "תעודת זיכוי", "החזרה", or "ביטול עסקה".
- If it is a standard purchase receipt (Invoice/Receipt/חשבונית) WITHOUT any refund/return indicators, classify it as 'INVALID'.

VERIFICATION RULES:
- The document MUST have a clear total amount.
- The document MUST be a refundable/credit document.

EXTRACT THESE FIELDS:
- storeName: The shop or merchant name.
- storeAddress: Full address if visible.
- date: YYYY-MM-DD.
- time: HH:MM.
- invoiceNumber: ID of the document (Asmachta, Heshbonit, Invoice #).
- currency: (₪, $, €, etc.). Default to ₪ if Israeli store.
- items: List each line item with its SKU (MKT/Code), name, quantity, and price.
- totalAmount: The final amount. For credit invoices, this is the amount to be returned to the customer.
- rejectionReason: If the document is 'INVALID' or missing a total amount, explain why in one short sentence.

Be extremely precise with SKU/MKT codes as they are often used for returns.
"""

def process_invoice_image(image_url: str) -> dict:
    """
    Downloads image bytes via the configured storage provider, encodes it,
    and calls the active LLM model using LiteLLM.
    Enforces structured JSON responses matching the InvoiceData schema.
    """
    model_name = os.getenv("LLM_MODEL", "gemini/gemini-2.5-flash")
    logger.info(f"Processing invoice using model: {model_name}")

    # 1. Fetch raw image bytes from storage provider (handles S3, GCS, or Base64 data URI)
    image_bytes = get_storage_provider().download_image(image_url)
    
    # 2. Base64 encode the image bytes for LiteLLM's standard multimodal message format
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    # 3. Formulate the multimodal user payload (OpenAI-compatible format)
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": PROMPT
                },
                {
                     "type": "image_url",
                     "image_url": {
                         "url": f"data:image/jpeg;base64,{base64_image}"
                     }
                }
            ]
        }
    ]

    # 4. Invoke the model via LiteLLM, requesting structured schema response
    response = litellm.completion(
        model=model_name,
        messages=messages,
        response_format=InvoiceData
    )

    # 5. Extract and parse response content
    content = response.choices[0].message.content
    if not content:
        raise ValueError(f"Empty response received from LiteLLM model {model_name}.")

    logger.info("Successfully parsed invoice metadata using LiteLLM.")
    return json.loads(content)
