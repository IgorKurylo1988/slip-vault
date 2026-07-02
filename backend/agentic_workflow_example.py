import os
import json
from typing import TypedDict, Annotated, List, Optional
from langgraph.graph import StateGraph, END
import litellm

# =====================================================================
# 1. State Definition
# =====================================================================
class AgentState(TypedDict):
    image_url: str
    raw_extraction: Optional[dict]
    validation_errors: List[str]
    tries: int
    is_valid: bool

# =====================================================================
# 2. Local Validation Tools
# =====================================================================
def verify_calculations(items: list, total_amount: float) -> dict:
    """Helper tool to verify math totals against line items."""
    item_sum = sum(item.get("price", 0) * item.get("quantity", 0) for item in items)
    mismatch = abs(item_sum - total_amount) > 0.05
    return {
        "calculated_sum": item_sum,
        "is_matching": not mismatch,
        "difference": item_sum - total_amount
    }

# =====================================================================
# 3. Graph Nodes
# =====================================================================
def extract_receipt_node(state: AgentState):
    """Initial multimodal extraction from the receipt image."""
    model_name = os.getenv("LLM_MODEL", "gemini/gemini-2.5-flash")
    
    prompt = """
    Analyze this receipt image. Extract:
    - storeName (string)
    - date (YYYY-MM-DD)
    - totalAmount (float)
    - items (list of: name, price, quantity)
    - type ('CREDIT_INVOICE' | 'INVOICE' | 'INVALID')
    
    Respond strictly in JSON format.
    """
    
    # Simulate a LiteLLM call
    response = litellm.completion(
        model=model_name,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": state["image_url"]}}
                ]
            }
        ],
        response_format={"type": "json_object"}
    )
    
    raw_json = json.loads(response.choices[0].message.content)
    return {
        "raw_extraction": raw_json,
        "tries": state["tries"] + 1
    }

def validate_extraction_node(state: AgentState):
    """Validation node running math total calculations."""
    extracted = state["raw_extraction"]
    errors = []
    
    # Run math tool check
    math_check = verify_calculations(
        extracted.get("items", []),
        extracted.get("totalAmount", 0.0)
    )
    
    if not math_check["is_matching"]:
        errors.append(
            f"Calculated line item sum ({math_check['calculated_sum']}) "
            f"does not match totalAmount ({extracted.get('totalAmount')})."
        )
        
    return {
        "validation_errors": errors,
        "is_valid": len(errors) == 0
    }

def re_extract_correction_node(state: AgentState):
    """Self-correction loop node re-prompting the LLM with the context of validation errors."""
    model_name = os.getenv("LLM_MODEL", "gemini/gemini-2.5-flash")
    
    prompt = f"""
    You extracted: {json.dumps(state['raw_extraction'])}
    The validation system detected the following mismatch errors:
    {state['validation_errors']}
    
    Please re-inspect the image, pay special attention to unit prices or missed item counts, and return the corrected JSON.
    """
    
    response = litellm.completion(
        model=model_name,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    raw_json = json.loads(response.choices[0].message.content)
    return {
        "raw_extraction": raw_json,
        "validation_errors": [],
        "tries": state["tries"] + 1
    }

# =====================================================================
# 4. Routing Logic (Edges)
# =====================================================================
def router(state: AgentState):
    """Determines whether to retry/correct or end the workflow execution."""
    if state["is_valid"]:
        return "end"
    if state["tries"] >= 3:
        return "end"
    return "correct"

# =====================================================================
# 5. Graph Assembly
# =====================================================================
workflow = StateGraph(AgentState)

# Add Node processing steps
workflow.add_node("extract", extract_receipt_node)
workflow.add_node("validate", validate_extraction_node)
workflow.add_node("correct", re-extract_correction_node)

# Set Entry-Point
workflow.set_entry_point("extract")

# Set transitions
workflow.add_edge("extract", "validate")
workflow.add_conditional_edges(
    "validate",
    router,
    {
        "correct": "correct",
        "end": END
    }
)
workflow.add_edge("correct", "validate")

# Compile Workflow
agent = workflow.compile()
