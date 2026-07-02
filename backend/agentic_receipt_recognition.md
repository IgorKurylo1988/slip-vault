# Step-by-Step Guide: Building Agentic Receipt Recognition

This guide outlines how to evolve a static LLM extraction service into an **Agentic Receipt Recognition System** that uses tools, validates math, corrects errors, and resolves store identities.

---

## Step 1: Define the Agent State and Schema

Create an internal state representation to track the receipt processing, validation results, and retry counters.

```python
from pydantic import BaseModel, Field
from typing import List, Optional

class AgentState(BaseModel):
    image_url: str
    raw_extraction: Optional[dict] = None
    validation_passed: bool = False
    validation_errors: List[str] = Field(default_factory=list)
    resolved_store: Optional[dict] = None
    retry_count: int = 0
    max_retries: int = 3
```

---

## Step 2: Implement Agent Tools

Define Python functions that the Gemini model can call as tools to execute calculations or lookups.

```python
def verify_math_totals(items: list, subtotal: float, tax: float, total: float) -> dict:
    """Calculates if the sum of items + tax matches the reported total amount."""
    calculated_subtotal = sum(item['price'] * item['quantity'] for item in items)
    calculated_total = calculated_subtotal + tax
    
    mismatch = abs(calculated_total - total) > 0.05
    return {
        "calculated_subtotal": calculated_subtotal,
        "calculated_total": calculated_total,
        "is_matching": not mismatch,
        "difference": calculated_total - total
    }

def lookup_merchant_details(store_name: str) -> dict:
    """Queries a business database or search engine to resolve store addresses/IDs."""
    # Simulated search registry database lookup
    known_merchants = {
        "shufersal": {"storeName": "Shufersal Ltd", "storeAddress": "Menachem Begin 121, Tel Aviv", "tax_id": "511234567"},
        "super-pharm": {"storeName": "Super-Pharm", "storeAddress": "HaYarkon 45, Tel Aviv", "tax_id": "513456789"}
    }
    key = store_name.lower().replace(" ", "")
    for merchant_key, details in known_merchants.items():
        if merchant_key in key:
            return details
    return {"storeName": store_name, "storeAddress": "Unknown, Registry lookup failed", "tax_id": None}
```

---

## Step 3: Build the Agentic Loop (Reasoning + Action)

Configure a recursive reflection loop where Gemini reviews its output, runs tool validations, and corrects itself.

```python
import json
import litellm

def run_agentic_pipeline(state: AgentState):
    model = "gemini/gemini-2.5-flash"
    
    # 1. First Pass: OCR & Multimodal Extraction
    extracted_data = call_multimodal_extraction(state.image_url)
    state.raw_extraction = extracted_data

    while state.retry_count < state.max_retries:
        state.validation_errors = []
        
        # 2. Action: Run Math Verification Tool
        math_check = verify_math_totals(
            extracted_data.get("items", []),
            extracted_data.get("subtotal") or 0.0,
            extracted_data.get("tax") or 0.0,
            extracted_data.get("totalAmount") or 0.0
        )
        
        # 3. Action: Run Merchant Store Lookup Tool
        store_check = lookup_merchant_details(extracted_data.get("storeName", ""))
        state.resolved_store = store_check
        
        # 4. Reason: Check for Mismatches
        if not math_check["is_matching"]:
            state.validation_errors.append(
                f"Math total mismatch! Extracted total was {extracted_data.get('totalAmount')}, "
                f"but items sum + tax calculated to {math_check['calculated_total']}."
            )
        
        # 5. Reflection: Exit if successful, or prompt model to correct itself
        if not state.validation_errors:
            state.validation_passed = True
            # Merge resolved store metadata
            state.raw_extraction.update(store_check)
            break
        else:
            state.retry_count += 1
            # Re-prompt Gemini with validation errors for correction
            extracted_data = call_correction_model(
                image_url=state.image_url,
                previous_output=state.raw_extraction,
                errors=state.validation_errors
            )
            state.raw_extraction = extracted_data

    return state
```

---

## Step 4: Integrate correction model calls

Define the correction prompt layout instructing Gemini to adjust its extraction based on the error logs.

```python
def call_correction_model(image_url: str, previous_output: dict, errors: list) -> dict:
    prompt = f"""
    Review your previous extraction output: {json.dumps(previous_output)}
    The validation engine detected the following errors: {", ".join(errors)}
    
    Please re-inspect the image, pay close attention to unit prices, quantities, VAT tax, and total amounts, and return the corrected JSON.
    """
    # LiteLLM completion call with response_format=InvoiceData
    response = litellm.completion(
        model="gemini/gemini-2.5-flash",
        messages=[{"role": "user", "content": prompt}],
        response_format=InvoiceData
    )
    return json.loads(response.choices[0].message.content)
```
