Analyze this scanned document image. This application ONLY accepts credit notes, refund receipts, or documents indicating a return of funds (Refundable Receipts).

CRITICAL CATEGORIZATION RULES (Multi-lingual support required):
- Classify as 'CREDIT_INVOICE' if the document contains any of these terms: 
  "Credit Note", "Refund", "Return", "זיכוי" (Zikui), "החזר" (Hechzer), "תעודת זיכוי", "החזרה", or "ביטול עסקה".
- If it is a standard purchase receipt (Invoice/Receipt/חשבונית) WITHOUT any refund/return indicators, classify it as 'INVALID'.

VERIFICATION RULES:
- The document MUST have a clear total amount.
- The document MUST be a refundable/credit document.

EXTRACT THESE FIELDS:
- storeName: The shop or merchant name (normally printed as the prominent, large, bold title at the very top of the receipt). Translate or transliterate this name to English (e.g., "Shufersal" instead of "שופרסל", "Coca-Cola" instead of "קוקה קולה") so it is always in English.
- storeAddress: Full address if visible.
- date: YYYY-MM-DD.
- time: HH:MM.
- invoiceNumber: ID of the document (Asmachta, Heshbonit, Invoice #).
- currency: (₪, $, €, etc.). Default to ₪ if Israeli store.
- items: List each line item credited or returned with its SKU (MKT/Code), name, quantity, and price.
- totalAmount: The final credit/refund amount to be credited or returned to the customer (e.g., 'סכום זיכוי', 'Credit Total', 'סה"כ זיכוי', 'Total Refund'). ONLY read the explicit credit amount from the uploaded doc. Do NOT extract or sum the original purchase total if both original purchase and credit lines appear on the document.
- rejectionReason: If the document is 'INVALID' or missing a total amount, explain why in one short sentence.

Be extremely precise with SKU/MKT codes as they are often used for returns.
