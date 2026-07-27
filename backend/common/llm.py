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

from .schemas import InvoiceItem, InvoiceData

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
- storeName: The shop or merchant name (normally printed as the prominent, large, bold title at the very top of the receipt).
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

def verify_math_totals(items: list, subtotal: float, tax: float, total: float) -> dict:
    """Calculates if the sum of items + tax matches the reported total amount."""
    calculated_subtotal = sum(item.get('price', 0.0) * item.get('quantity', 0.0) for item in items)
    calculated_total = calculated_subtotal + tax
    
    mismatch = abs(calculated_total - total) > 0.05
    return {
        "calculated_subtotal": calculated_subtotal,
        "calculated_total": calculated_total,
        "is_matching": not mismatch,
        "difference": calculated_total - total
    }

class MerchantResolution(BaseModel):
    storeName: str = Field(description="The exact official resolved merchant name.")
    storeAddress: Optional[str] = Field(default=None, description="The resolved standard registry address.")

def lookup_merchant_details(store_name: str, extracted_address: Optional[str] = None) -> dict:
    """Uses Gemini Google Search Grounding tool to resolve raw merchant names and addresses exactly."""
    model_name = os.getenv("LLM_MODEL", "gemini/gemini-2.5-flash")
    logger.info(f"Resolving merchant '{store_name}' using Google Search grounding...")
    
    try:
        # Step 1: Research merchant on Google Search using built-in grounding retriever
        research_prompt = f"Search Google to resolve the exact corporate name and standard registry address of the merchant: '{store_name}'."
        
        # Adjust search tool format depending on whether model uses Vertex AI or Google AI Studio
        search_tool = {"googleSearch": {}} if model_name.startswith("vertex_ai") else {"google_search_retriever": {}}

        response = litellm.completion(
            model=model_name,
            messages=[{"role": "user", "content": research_prompt}],
            tools=[search_tool]
        )
        
        search_context = response.choices[0].message.content or ""
        logger.info(f"Google Search Grounding research context: {search_context}")
        
        # Step 2: Format the grounded search findings into structured JSON
        resolution_prompt = f"""
        Review this research context:
        ---
        {search_context}
        ---
        
        Convert this research into a structured format for the merchant: "{store_name}".
        Return the official corporate storeName and standard registry address.
        If the search context is empty or failed, use the raw store name and address: "{extracted_address or ''}".
        """
        
        response_struct = litellm.completion(
            model=model_name,
            messages=[{"role": "user", "content": resolution_prompt}],
            response_format=MerchantResolution
        )
        
        content = response_struct.choices[0].message.content
        if content:
            res = json.loads(content)
            return {
                "storeName": res.get("storeName") or store_name,
                "storeAddress": res.get("storeAddress") or extracted_address
            }
            
    except Exception as e:
        logger.error(f"Google Search merchant resolution failed: {e}")
        
    return {"storeName": store_name, "storeAddress": extracted_address}

def process_invoice_image(image_url: str) -> dict:
    """
    Agentic Receipt Recognition Pipeline:
    1. Downloads image bytes via GCS, encodes it.
    2. Runs initial multimodal OCR extraction.
    3. Triggers self-correcting reasoning loop running math totals verification.
    4. Dynamically re-prompts the model with error feedback up to 3 times on failures.
    5. Merges merchant database registry lookups.
    """
    model_name = os.getenv("LLM_MODEL", "gemini/gemini-2.5-flash")
    logger.info(f"Agentic Pipeline started using model: {model_name}")

    # 1. Fetch raw image bytes from storage provider
    image_bytes = get_storage_provider().download_image(image_url)
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    # First Pass: Multimodal OCR Extraction
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

    response = litellm.completion(
        model=model_name,
        messages=messages,
        response_format=InvoiceData
    )
    
    content = response.choices[0].message.content
    if not content:
        raise ValueError(f"Empty response received from LiteLLM model {model_name}.")

    extracted_data = json.loads(content)
    
    # Self-Correction Agentic Loop
    retry_count = 0
    max_retries = 3
    
    while retry_count < max_retries:
        validation_errors = []
        
        # Action: Math Verification Tool
        math_check = verify_math_totals(
            extracted_data.get("items", []),
            extracted_data.get("subtotal") or 0.0,
            extracted_data.get("tax") or 0.0,
            extracted_data.get("totalAmount") or 0.0
        )
        
        # Action: Merchant Store Lookup Tool
        store_check = lookup_merchant_details(
            extracted_data.get("storeName", ""),
            extracted_data.get("storeAddress")
        )
        
        # Reason: Check for mismatches
        if not math_check["is_matching"] and extracted_data.get("type") != "INVALID":
            validation_errors.append(
                f"Math total mismatch! Extracted total was {extracted_data.get('totalAmount')}, "
                f"but sum of items ({math_check['calculated_subtotal']}) + tax ({extracted_data.get('tax') or 0.0}) calculated to {math_check['calculated_total']}."
            )
            
        # Reflection: Exit if successful, or prompt model to correct itself
        if not validation_errors:
            logger.info("Agent validation succeeded. Correcting merchant registry metadata.")
            extracted_data.update(store_check)
            break
        else:
            retry_count += 1
            logger.warning(f"Agent validation failed (Attempt {retry_count}/{max_retries}). Errors: {validation_errors}")
            
            # Correction prompt incorporating base64 image context
            correction_prompt = f"""
            Review your previous extraction output: {json.dumps(extracted_data)}
            The validation engine detected the following errors: {", ".join(validation_errors)}
            
            Please re-inspect the image, pay close attention to unit prices, quantities, VAT tax, and total amounts, and return the corrected JSON.
            """
            
            correction_messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": correction_prompt
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
            
            response = litellm.completion(
                model=model_name,
                messages=correction_messages,
                response_format=InvoiceData
            )
            
            content = response.choices[0].message.content
            if not content:
                break
            extracted_data = json.loads(content)

    return extracted_data
