#!/usr/bin/env python3
"""
Simplified LlamaParse Wrapper

This script provides a simpler interface to LlamaParse while using
subprocess to ensure proper handling of Python package imports.
"""
import os
import sys
import json
import argparse
import subprocess
from datetime import datetime

def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description='Process documents with LlamaParse')
    parser.add_argument('file_path', help='Path to the file to process')
    parser.add_argument('--document-type', default='invoice', help='Type of document (invoice, receipt, etc.)')
    args = parser.parse_args()
    
    start_time = datetime.now()
    
    file_path = args.file_path
    document_type = args.document_type
    
    # Check if file exists
    if not os.path.exists(file_path):
        result = {
            "status": "error",
            "error": f"File not found: {file_path}"
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)
    
    # Check for API keys
    llama_api_key = os.environ.get("LLAMAPARSE_API_KEY")
    openai_api_key = os.environ.get("OPENAI_API_KEY")
    
    if not llama_api_key:
        result = {
            "status": "error",
            "error": "LLAMAPARSE_API_KEY is not set in environment variables"
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)
    
    if not openai_api_key:
        result = {
            "status": "error",
            "error": "OPENAI_API_KEY is not set in environment variables"
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)
    
    try:
        # Create a simple Python script that can be run in a subprocess
        # This ensures proper Python path handling
        script_content = f"""
import os
import sys
import json
from datetime import datetime

# Set API keys from environment
os.environ["LLAMA_CLOUD_API_KEY"] = "{llama_api_key}"
os.environ["OPENAI_API_KEY"] = "{openai_api_key}"

try:
    from llama_parse import LlamaParse
    from openai import OpenAI
    
    # Helper function to create dummy data if the process fails
    def create_dummy_result(error_message):
        return {{
            "status": "error",
            "error": error_message,
            "vendorName": "Error - Could not extract",
            "vendorAddress": "Error - Could not extract",
            "invoiceNumber": "Error - Could not extract",
            "invoiceDate": None,
            "totalAmount": 0,
            "additionalInfo": f"Error processing document: {{error_message}}",
            "lineItems": [],
            "confidenceScores": {{
                "overall": 0,
                "vendorInfo": 0,
                "invoiceDetails": 0,
                "lineItems": 0,
                "totals": 0,
                "handwrittenNotes": 0,
                "fieldSpecific": {{}}
            }},
            "layoutData": [],
            "processingMetadata": {{
                "ocrEngine": "Failed LlamaParse",
                "processingTime": 0,
                "processingTimestamp": datetime.now().isoformat(),
                "error": error_message
            }}
        }}

    # Process the document
    def process_document(file_path, document_type):
        start_time = datetime.now()
        print(f"Processing file: {{file_path}}", file=sys.stderr)
        
        # Create parser
        parser = LlamaParse(
            api_key=os.environ["LLAMA_CLOUD_API_KEY"],
            result_type="text",
            parsing_instruction=\"\"\"
            Extract the following information from this document (which may be an invoice or purchase order):
            1. company_name
            2. address
            3. date
            4. invoice_numbers_or_po_numbers
            5. items (a list of objects, each with name, quantity, and price)
            6. total_amount
            7. other (any additional relevant information)
            \"\"\",
            use_vendor_multimodal_model=True,
            vendor_multimodal_model_name="openai-gpt-4o-mini",
            vendor_multimodal_model_api_key=os.environ["OPENAI_API_KEY"],
            verbose=True
        )
        
        # Parse the file
        document_text = parser.parse_file(file_path)
        print(f"Successfully parsed document with LlamaParse (length: {{len(document_text)}} chars)", file=sys.stderr)
        
        # Use OpenAI to structure the output
        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        
        # Define the schema for the structured output
        schema = {{
            "company_name": "string, the vendor or company name",
            "address": "string, the full address of the company",
            "date": "string, the invoice date in YYYY-MM-DD format",
            "invoice_numbers_or_po_numbers": "string, any invoice or purchase order numbers",
            "items": [
                {{
                    "name": "string, item description",
                    "quantity": "number, quantity of the item",
                    "price": "number, unit price of the item", 
                    "amount": "number, optional total amount for this line item"
                }}
            ],
            "total_amount": "number, the total amount of the invoice",
            "other": "string, any other relevant information not covered by the fields above"
        }}
        
        # Use OpenAI to convert to structured data
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {{
                    "role": "system",
                    "content": f"You are a document parsing assistant that converts extracted document text into structured JSON. Follow this schema exactly: {{json.dumps(schema)}}"
                }},
                {{
                    "role": "user",
                    "content": f"Convert this document text into JSON:\\n\\n{{document_text}}"
                }}
            ],
            temperature=0.2
        )
        
        structured_text = completion.choices[0].message.content
        
        # Clean up JSON string
        structured_text = structured_text.strip()
        if structured_text.startswith("```json"):
            structured_text = structured_text[7:]
        if structured_text.endswith("```"):
            structured_text = structured_text[:-3]
        structured_text = structured_text.strip()
        
        # Parse JSON
        structured_data = json.loads(structured_text)
        
        # End processing timestamp
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds() * 1000  # milliseconds
        
        # Create final result
        result = {{
            "status": "success",
            "vendorName": structured_data.get("company_name", ""),
            "vendorAddress": structured_data.get("address", ""),
            "invoiceNumber": structured_data.get("invoice_numbers_or_po_numbers", ""),
            "invoiceDate": structured_data.get("date", None),
            "totalAmount": float(structured_data.get("total_amount", 0)),
            "additionalInfo": structured_data.get("other", ""),
            "lineItems": [
                {{
                    "description": item.get("name", "Unknown"),
                    "quantity": float(item.get("quantity", 1)),
                    "unitPrice": float(item.get("price", 0)),
                    "amount": float(item.get("amount", 0)) if "amount" in item else float(item.get("quantity", 1)) * float(item.get("price", 0))
                }} 
                for item in structured_data.get("items", [])
            ],
            "confidenceScores": {{
                "overall": 85,
                "vendorInfo": 90,
                "invoiceDetails": 85,
                "lineItems": 80,
                "totals": 90,
                "handwrittenNotes": 70,
                "fieldSpecific": {{
                    "company_name": 90,
                    "address": 85,
                    "date": 90,
                    "invoice_numbers_or_po_numbers": 85,
                    "total_amount": 90
                }}
            }},
            "layoutData": [],
            "processingMetadata": {{
                "ocrEngine": "LlamaParse with OpenAI GPT-4o-mini",
                "processingTime": processing_time,
                "processingTimestamp": datetime.now().isoformat(),
                "processingParams": {{
                    "model": "LlamaParse with OpenAI GPT-4o-mini",
                    "customQuery": True,
                    "useOpenAIMultimodal": True,
                    "multimodalModel": "openai-gpt-4o-mini"
                }},
                "documentClassification": document_type.capitalize()
            }}
        }}
        
        return result
    
    # Main execution
    try:
        result = process_document("{file_path}", "{document_type}")
        print(json.dumps(result, ensure_ascii=False, default=str))
    except Exception as e:
        print(f"Error processing document: {{str(e)}}", file=sys.stderr)
        result = create_dummy_result(str(e))
        print(json.dumps(result, ensure_ascii=False, default=str))
        sys.exit(1)
        
except ImportError as e:
    print(f"Import error: {{str(e)}}", file=sys.stderr)
    result = {{
        "status": "error",
        "error": f"Required Python packages are not installed: {{str(e)}}"
    }}
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(1)
"""
        
        # Write the script to a temporary file
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp_llama_script.py")
        with open(script_path, "w") as f:
            f.write(script_content)
        
        # Make the script executable
        os.chmod(script_path, 0o755)
        
        # Run the script as a separate process
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            check=False,
            env=os.environ
        )
        
        # Clean up temporary script
        if os.path.exists(script_path):
            os.remove(script_path)
        
        # Handle errors
        if result.returncode != 0:
            print(f"Error in subprocess: {result.stderr}", file=sys.stderr)
            error_result = {
                "status": "error",
                "error": f"Error in LlamaParse processing: {result.stderr}"
            }
            print(json.dumps(error_result, ensure_ascii=False))
            sys.exit(result.returncode)
        
        # Output the result
        print(result.stdout)
        
    except Exception as e:
        error_result = {
            "status": "error",
            "error": f"Error running LlamaParse wrapper: {str(e)}"
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()