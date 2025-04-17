#!/usr/bin/env python3
"""
LlamaParse Wrapper - Document Processing Script
This script processes documents using LlamaParse and returns structured data.
"""
import os
import sys
import json
import base64
import tempfile
from datetime import datetime
from typing import Dict, Any, Union, List, Optional

# Load API keys from environment variables
os.environ["LLAMA_CLOUD_API_KEY"] = os.environ.get("LLAMAPARSE_API_KEY", "")
os.environ["OPENAI_API_KEY"] = os.environ.get("OPENAI_API_KEY", "")

try:
    from llama_parse import LlamaParse
except ImportError:
    print("Error: Could not import LlamaParse. Please install it with 'pip install llama-parse'", file=sys.stderr)
    sys.exit(1)

def process_document(file_path, document_type="invoice"):
    """
    ฟังก์ชันประมวลผลเอกสารโดยใช้ LlamaParse API แล้วแปลงเป็น JSON

    Args:
        file_path: พาธของไฟล์เอกสาร
        document_type: ประเภทเอกสาร (receipt, invoice, document เป็นต้น)

    Returns:
        str: JSON string ที่มีผลลัพธ์การประมวลผล
    """
    print(f"Starting Llama Parse processing of file: {file_path}", file=sys.stderr)
    start_time = datetime.now()

    # ตรวจสอบว่า LlamaParse สามารถใช้งานได้หรือไม่
    if 'LlamaParse' not in globals():
        print("LlamaParse module is not available", file=sys.stderr)
        return json.dumps({
            "status": "error",
            "document_type": document_type,
            "parsing_service": "llama",
            "error": "LlamaParse is not available. Please install the llama-parse package."
        }, ensure_ascii=False)
    
    # ตรวจสอบไฟล์
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}", file=sys.stderr)
        return json.dumps({
            "status": "error",
            "document_type": document_type,
            "parsing_service": "llama",
            "error": f"File not found: {file_path}"
        }, ensure_ascii=False)
    
    # ดึงค่า API key จาก environment variables
    llama_api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    openai_api_key = os.environ.get("OPENAI_API_KEY")
    
    if not llama_api_key:
        print("LLAMA_CLOUD_API_KEY is not set in environment variables", file=sys.stderr)
        return json.dumps({
            "status": "error",
            "document_type": document_type,
            "parsing_service": "llama",
            "error": "LLAMA_CLOUD_API_KEY is required but not provided in environment variables"
        }, ensure_ascii=False)
    
    if not openai_api_key:
        print("OPENAI_API_KEY is not set in environment variables", file=sys.stderr)
        return json.dumps({
            "status": "error",
            "document_type": document_type,
            "parsing_service": "llama",
            "error": "OPENAI_API_KEY is required but not provided in environment variables"
        }, ensure_ascii=False)
    
    # สร้างคำสั่งพิเศษสำหรับการ parse ตามประเภทเอกสาร
    parsing_instruction = """
    Extract the following information from this document (which may be an invoice or purchase order, in Thai or English):
    1. company_name
    2. address
    3. date
    4. invoice_numbers_or_po_numbers
    5. items (a list of objects, each with name, quantity, and price). Extract every item listed in the document, and do not omit any items unless they are crossed out or struck through.
       - If an item is crossed out but replaced by another value (e.g., a handwritten correction), only display the replacement value in the output (not the crossed-out one).
       - If you are unsure about any item, indicate so.
    6. total_amount
    7. other (any additional relevant information not covered above)

    This document may be entirely or partially in Thai or English, and it may contain handwritten text. Carefully extract the information, ignoring any crossed-out or struck-through items.
    If any item was crossed out but replaced with a handwritten correction, use the new corrected value and exclude the crossed-out version.
    """
    
    original_filename = os.path.basename(file_path)
    
    # เรียกใช้ LlamaParse API
    try:
        # สร้าง LlamaParse instance
        print(f"Initializing LlamaParse with API key", file=sys.stderr)
        parser = LlamaParse(
            api_key=llama_api_key,
            parsing_instruction=parsing_instruction,
            result_type="text",
            use_vendor_multimodal_model=True,
            vendor_multimodal_model_name="openai-gpt-4o-mini",
            vendor_multimodal_model_api_key=openai_api_key,
            verbose=True
        )
        
        # แสดงข้อมูลไฟล์
        print(f"Processing file: {original_filename} (path: {file_path})", file=sys.stderr)
        
        # ประมวลผลเอกสาร
        print("Calling LlamaParse API...", file=sys.stderr)
        document_markdown = parser.parse_file(file_path)
        
        # แปลง markdown เป็น text และ JSON
        print("Converting parsed output to JSON...", file=sys.stderr)
        
        # เรียกใช้ OpenAI API เพื่อแปลง markdown เป็น JSON
        from openai import OpenAI
        client = OpenAI(api_key=openai_api_key)
        
        # สร้าง schema สำหรับ JSON output ตามประเภทเอกสาร
        if document_type == "invoice":
            schema = {
                "company_name": "string, the vendor or company name",
                "address": "string, the full address of the company",
                "date": "string, the invoice date in YYYY-MM-DD format",
                "invoice_numbers_or_po_numbers": "string, any invoice or purchase order numbers",
                "items": [
                    {
                        "name": "string, item description",
                        "quantity": "number, quantity of the item",
                        "price": "number, unit price of the item", 
                        "amount": "number, optional total amount for this line item"
                    }
                ],
                "total_amount": "number, the total amount of the invoice",
                "other": "string, any other relevant information not covered by the fields above"
            }
        else:
            # ใช้ schema ทั่วไปสำหรับเอกสารอื่นๆ
            schema = {
                "title": "string, document title",
                "date": "string, document date in YYYY-MM-DD format",
                "content": "string, main document content",
                "other": "string, any other relevant information"
            }
        
        # แปลง markdown เป็น JSON ด้วย OpenAI
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"You are a document parsing assistant that converts extracted document text into structured JSON. Follow this schema exactly: {json.dumps(schema)}"
                },
                {
                    "role": "user",
                    "content": f"Convert this document text into JSON:\n\n{document_markdown}"
                }
            ],
            temperature=0.2
        )
        
        json_result = completion.choices[0].message.content
        
        # ทำความสะอาด JSON string และแปลงเป็น dict
        json_result = json_result.strip()
        if json_result.startswith("```json"):
            json_result = json_result[7:]
        if json_result.endswith("```"):
            json_result = json_result[:-3]
        json_result = json_result.strip()
        
        # แปลง JSON string เป็น dict
        try:
            result_dict = json.loads(json_result)
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON: {e}", file=sys.stderr)
            print(f"Raw JSON:\n{json_result}", file=sys.stderr)
            # Try to fix common JSON formatting issues
            json_result = json_result.replace("'", "\"")
            try:
                result_dict = json.loads(json_result)
            except:
                result_dict = {"error": "Could not parse JSON result"}
        
        # คำนวณค่า confidence (ตัวอย่าง)
        confidence_scores = {
            "overall": 85,
            "vendorInfo": 90,
            "invoiceDetails": 85,
            "lineItems": 80,
            "totals": 90,
            "handwrittenNotes": 70,
            "fieldSpecific": {
                "company_name": 90,
                "address": 85,
                "date": 90,
                "invoice_numbers_or_po_numbers": 85,
                "total_amount": 90
            }
        }
        
        # สร้าง layout positions (ตัวอย่าง)
        layout_positions = []
        
        # สร้าง processing metadata
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds() * 1000  # milliseconds
        
        processing_metadata = {
            "ocrEngine": "LlamaParse with OpenAI GPT-4o-mini",
            "processingTime": processing_time,
            "processingTimestamp": datetime.now().isoformat(),
            "processingParams": {
                "model": "LlamaParse with OpenAI GPT-4o-mini",
                "confidence_threshold": 0.5,
                "customQuery": True,
                "useOpenAIMultimodal": True,
                "multimodalModel": "openai-gpt-4o-mini"
            },
            "documentClassification": "Invoice"
        }
        
        # สร้าง final response
        response = {
            "status": "success",
            "document_type": document_type,
            "parsing_service": "llama",
            "raw_markdown": document_markdown,
            "extraction": result_dict,
            "confidenceScores": confidence_scores,
            "layoutData": layout_positions,
            "processingMetadata": processing_metadata
        }
        
        print("Finished processing document", file=sys.stderr)
        return json.dumps(response, ensure_ascii=False)
        
    except Exception as e:
        import traceback
        print(f"Error processing document: {str(e)}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return json.dumps({
            "status": "error",
            "document_type": document_type,
            "parsing_service": "llama",
            "error": str(e)
        }, ensure_ascii=False)

if __name__ == "__main__":
    # Check if file path is provided
    if len(sys.argv) < 2:
        print("Usage: python llama_parse_wrapper.py <file_path> [document_type]", file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    document_type = sys.argv[2] if len(sys.argv) > 2 else "invoice"
    
    # Process the document and print the result to stdout
    result = process_document(file_path, document_type)
    print(result)