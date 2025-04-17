# Use a detailed extraction prompt for invoices/POs in Thai and English
extraction_query = (
    "Extract the following information from this document (which may be an invoice or purchase order, in Thai or English):\n"
    "1. company_name\n"
    "2. address\n"
    "3. date\n"
    "4. invoice_numbers_or_po_numbers\n"
    "5. items (a list of objects, each with name, quantity, and price). Extract every item listed in the document, and do not omit any items unless they are crossed out or struck through.\n"
    "   - If an item is crossed out but replaced by another value (e.g., a handwritten correction), only display the replacement value in the output (not the crossed-out one).\n"
    "   - If you are unsure about any item, indicate so.\n"
    "6. total_amount\n"
    "7. other (any additional relevant information not covered above)\n"
    "\nThis document may be entirely or partially in Thai or English, and it may contain handwritten text. Carefully extract the information, ignoring any crossed-out or struck-through items.\n"
    "If any item was crossed out but replaced with a handwritten correction, use the new corrected value and exclude the crossed-out version.\n"
    "\nOutput the result as a JSON object with the following fields:\n"
    "company_name, address, date, invoice_numbers_or_po_numbers, items, total_amount, other.\n"
    "The 'items' field should be a list of objects, each with name, quantity, and price.\n"
)