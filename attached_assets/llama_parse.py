import os
import sys
import json
import base64
import tempfile
import requests
from datetime import datetime
from typing import Dict, Any, Union, List, Optional

# กำหนดค่า API keys โดยตรง
os.environ["LLAMA_CLOUD_API_KEY"] = os.environ.get("LLAMA_CLOUD_API_KEY", "")
os.environ["OPENAI_API_KEY"] = os.environ.get("OPENAI_API_KEY", "")

try:
    from llama_parse import LlamaParse
except ImportError:
    print("Error: Could not import LlamaParse. Please install it with 'pip install llama-parse'", file=sys.stderr)

def process_document(source, document_type):
    """
    ฟังก์ชันประมวลผลเอกสารโดยใช้ LlamaParse API แล้วแปลงเป็น Markdown, Text และ JSON

    Args:
        source: ข้อมูลไฟล์ (bytes) หรือ URL ของเอกสาร
        document_type: ประเภทเอกสาร (receipt, invoice, document เป็นต้น)

    Returns:
        str: JSON string ที่มีผลลัพธ์การประมวลผล
    """
    print("Starting Llama Parse processing", file=sys.stderr)

    # ตรวจสอบว่า LlamaParse สามารถใช้งานได้หรือไม่
    if 'LlamaParse' not in globals():
        print("LlamaParse module is not available", file=sys.stderr)
        return json.dumps({
            "status": "error",
            "document_type": document_type,
            "parsing_service": "llama",
            "error": "LlamaParse is not available. Please install the llama-parse package."
        }, ensure_ascii=False)
    
    # ตรวจสอบรูปแบบไฟล์
    file_type = None
    if isinstance(source, bytes):
        if source.startswith(b'%PDF'):
            file_type = "pdf"
            print("Detected PDF file format", file=sys.stderr)
        elif source.startswith(b'\x89PNG'):
            file_type = "png"
            print("Detected PNG file format", file=sys.stderr)
        elif source.startswith(b'\xff\xd8'):
            file_type = "jpeg"
            print("Detected JPEG file format", file=sys.stderr)
        else:
            print("Unknown file format. Assuming PDF.", file=sys.stderr)
            file_type = "pdf"
    
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
    parsing_instruction = None
    if document_type == "receipt":
        parsing_instruction = """
        Extract all information from this receipt including:
        - Merchant name, address, and contact details
        - Date and time of purchase
        - Receipt number or transaction ID
        - All items purchased with descriptions, quantities, unit prices, and totals
        - Subtotal, tax amount, discounts, and grand total
        - Payment method and any payment details
        
        Format the output as a clear, structured markdown document with appropriate headers and tables for the items.
        """
    elif document_type == "invoice":
        parsing_instruction = """
        Extract all information from this invoice document including:
        
        1. Invoice Number, Date, and Due Date
        2. Vendor/Seller Information:
       - Company name
       - Address
       - Contact information (phone, email)
           - Tax ID number
        
        3. Customer/Buyer Information:
       - Company name
       - Address
           - Contact information
        
        4. Line Items:
           - Create a markdown table with columns for: 
             * Item number/ID
             * Description
             * Quantity
             * Unit
             * Unit price
             * Discount (if applicable)
             * Amount
        
        5. Summary Information:
           - Subtotal (before tax)
           - Discount total (if applicable)
           - Tax details (rate and amount)
           - Total amount
           - Amount in words (if present)
        
        6. Payment Information:
           - Payment terms
           - Due date
           - Bank details or payment instructions
        
        7. Additional Notes or Terms and Conditions
        
        8. Signatures or Authorization Details (if present)
        
        Format this information as a well-structured markdown document with clear headings, 
        lists, and tables. Preserve all important details exactly as they appear in the document.
        """
    else:
        parsing_instruction = """
        Extract all information from this document in a structured manner.
        Include headings, sections, tables, and any key information.
        Format as clear, structured markdown.
        """
    
    # เริ่มประมวลผลเอกสาร
    try:
        # สร้างไฟล์ชั่วคราว
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_type}" if file_type else ".pdf") as temp_file:
            if isinstance(source, bytes):
                temp_file.write(source)
                print(f"Wrote {len(source)} bytes to temporary file", file=sys.stderr)
            elif isinstance(source, str) and (source.startswith('http://') or source.startswith('https://')):
                # ดาวน์โหลดไฟล์จาก URL
                response = requests.get(source)
                if response.status_code == 200:
                    temp_file.write(response.content)
                    print(f"Downloaded file from URL successfully", file=sys.stderr)
                else:
                    error_message = f"Failed to download file from URL: {response.status_code}"
                    print(error_message, file=sys.stderr)
                    return json.dumps({
                        "status": "error",
                        "document_type": document_type,
                        "parsing_service": "llama",
                        "error": error_message
                    }, ensure_ascii=False)
            else:
                error_message = "Invalid source format. Must be bytes or URL."
                print(error_message, file=sys.stderr)
                return json.dumps({
                "status": "error",
                    "document_type": document_type,
                    "parsing_service": "llama",
                    "error": error_message
                }, ensure_ascii=False)
            
            temp_file_path = temp_file.name
            print(f"Temporary file saved at: {temp_file_path}", file=sys.stderr)
        
        # ตรวจสอบว่าไฟล์ถูกสร้างขึ้นจริง
        if not os.path.exists(temp_file_path):
            raise FileNotFoundError(f"Temporary file was not created: {temp_file_path}")
        
        original_filename = os.path.basename(temp_file_path)
        
        # เรียกใช้ LlamaParse API
        try:
            # สร้าง LlamaParse instance
            print(f"Initializing LlamaParse with API key", file=sys.stderr)
            parser = LlamaParse(
                api_key=llama_api_key,
                parsing_instruction=parsing_instruction,
                result_type="markdown",
                use_vendor_multimodal_model=True,
                vendor_multimodal_model_name="openai-gpt-4o-mini",
                vendor_multimodal_model_api_key=openai_api_key,
                verbose=True,
            )
            
            print(f"Parsing file with LlamaParse: {temp_file_path}", file=sys.stderr)
            
            # ทำการ parse ไฟล์
            result = parser.load_data(temp_file_path)
            
            # ตรวจสอบผลลัพธ์
            print(f"LlamaParse result type: {type(result)}", file=sys.stderr)
            
            markdown_content = None
            if isinstance(result, list) and len(result) > 0:
                # ดึงเอา text จาก Document object
                if hasattr(result[0], 'text'):
                    markdown_content = result[0].text
                    print(f"Successfully extracted markdown content of length: {len(markdown_content)}", file=sys.stderr)
                else:
                    print(f"Error: result[0] doesn't have 'text' attribute. Available attributes: {dir(result[0])}", file=sys.stderr)
            else:
                print(f"Warning: No documents returned from LlamaParse. Result: {result}", file=sys.stderr)
            
            # ถ้าไม่มี markdown content จากการ parse ให้รายงานข้อผิดพลาด
            if not markdown_content:
                raise ValueError("No markdown content was generated by Llama Parse")
            
            # แปลง markdown เป็น text
            print("Converting markdown to text...", file=sys.stderr)
            text_content = convert_markdown_to_text(markdown_content)
            
            # แปลง markdown เป็น JSON ด้วย OpenAI API
            print("Converting markdown to JSON using OpenAI API...", file=sys.stderr)
            json_content = convert_markdown_to_json(markdown_content, document_type, openai_api_key)
            
            # บันทึกไฟล์ทั้งหมด
            print("Saving result files...", file=sys.stderr)
            
            # เตรียมผลลัพธ์สำหรับส่งกลับ
            base_name = os.path.splitext(original_filename)[0]
            upload_dir = os.path.join(os.getcwd(), "uploads/original")
            
            # สร้างโฟลเดอร์สำหรับแต่ละประเภทไฟล์
            markdown_dir = os.path.join(os.getcwd(), "uploads/markdown")
            text_dir = os.path.join(os.getcwd(), "uploads/text")
            json_dir = os.path.join(os.getcwd(), "uploads/json")
            
            for directory in [markdown_dir, text_dir, json_dir]:
                if not os.path.exists(directory):
                    os.makedirs(directory)
            
            # บันทึกไฟล์ markdown
            markdown_path = os.path.join(markdown_dir, f"{base_name}.md")
            with open(markdown_path, 'w', encoding='utf-8') as f:
                f.write(markdown_content)
            print(f"Saved markdown to: {markdown_path}", file=sys.stderr)
            
            # บันทึกไฟล์ text
            text_path = os.path.join(text_dir, f"{base_name}.txt")
            with open(text_path, 'w', encoding='utf-8') as f:
                f.write(text_content)
            print(f"Saved text to: {text_path}", file=sys.stderr)
            
            # บันทึกไฟล์ JSON
            json_path = os.path.join(json_dir, f"{base_name}.json")
            with open(json_path, 'w', encoding='utf-8') as f:
                if isinstance(json_content, dict) or isinstance(json_content, list):
                    json.dump(json_content, f, ensure_ascii=False, indent=2)
                else:
                    f.write(str(json_content))
            print(f"Saved JSON to: {json_path}", file=sys.stderr)
            
            # สร้างผลลัพธ์สำหรับส่งกลับ
            result = {
                "status": "success",
                "document_type": document_type,
                "parsing_service": "llama",
                "markdown": markdown_content,
                "text": text_content,
                "json": json_content,
                "filePath": original_filename,
                "mimeType": f"application/{file_type}",
                "processed_at": datetime.now().isoformat()
            }
            
            print("Returning results to frontend", file=sys.stderr)
            return json.dumps(result, ensure_ascii=False)
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            error_message = f"Error processing with LlamaParse: {str(e)}\n{error_trace}"
            print(error_message, file=sys.stderr)
            return json.dumps({
                "status": "error",
                "document_type": document_type,
                "parsing_service": "llama",
                "error": f"Error processing with LlamaParse: {str(e)}"
            }, ensure_ascii=False)
        finally:
            # เราต้องการเก็บไฟล์ต้นฉบับไว้ในโฟลเดอร์ uploads
            try:
                # คัดลอกไฟล์ต้นฉบับไปยังโฟลเดอร์ uploads
                upload_path = os.path.join(upload_dir, original_filename)
                with open(temp_file_path, 'rb') as src_file:
                    with open(upload_path, 'wb') as dst_file:
                        dst_file.write(src_file.read())
                print(f"Saved original file to: {upload_path}", file=sys.stderr)
            except Exception as e:
                print(f"Error saving original file: {str(e)}", file=sys.stderr)
            
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        error_message = f"Unexpected error: {str(e)}\n{error_trace}"
        print(error_message, file=sys.stderr)
        return json.dumps({
            "status": "error",
            "document_type": document_type,
            "parsing_service": "llama",
            "error": f"Unexpected error: {str(e)}"
        }, ensure_ascii=False)
    finally:
        # ลบไฟล์ชั่วคราว (หลังจากที่เราได้คัดลอกไปยังโฟลเดอร์ uploads แล้ว)
        if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                print(f"Deleted temporary file: {temp_file_path}", file=sys.stderr)
            except Exception as e:
                print(f"Error deleting temporary file: {str(e)}", file=sys.stderr)

def convert_markdown_to_text(markdown_content):
    """
    แปลง markdown เป็น text
    
    Args:
        markdown_content: เนื้อหา markdown ที่ต้องการแปลง
        
    Returns:
        str: เนื้อหา text ที่แปลงแล้ว
    """
    if not markdown_content:
        return ""

    # แทนที่ headers
    text = markdown_content
    text = text.replace("# ", "").replace("## ", "").replace("### ", "")

    # แทนที่ formatting
    text = text.replace("**", "").replace("*", "").replace("__", "").replace("_", "")

    # แปลงตารางเป็นข้อความปกติ
    lines = text.split("\n")
    result = []

    for line in lines:
        # ข้ามบรรทัดแบ่งตาราง
        if line.startswith("|") and "-|-" in line:
            continue

        # แปลงแถวตาราง
        if line.startswith("|") and line.endswith("|"):
            cells = [cell.strip() for cell in line.split("|") if cell.strip()]
            result.append(", ".join(cells))
        else:
            result.append(line)

    return "\n".join(result)

def convert_markdown_to_json(markdown_content, document_type, api_key):
    """
    แปลง markdown เป็น JSON โดยใช้ OpenAI API
    
    Args:
        markdown_content: เนื้อหา markdown ที่ต้องการแปลง
        document_type: ประเภทเอกสาร
        api_key: OpenAI API key
        
    Returns:
        dict: เนื้อหา JSON ที่แปลงแล้ว
    """
    if not markdown_content or not api_key:
        return {"error": "Missing markdown content or API key"}
    
    # กำหนด instruction ตามประเภทเอกสาร
    if document_type == "receipt":
        system_instruction = """
        You are an expert in converting receipt data from markdown to structured JSON.
        Create a JSON object with these fields:
        - merchant_info: object with name, address, phone
        - transaction_info: object with date, time, receipt_number
        - items: array of objects with description, quantity, unit_price, total
        - payment_info: object with subtotal, tax, discount, total_amount, payment_method
        - additional_info: any other relevant information
        
        Provide ONLY valid JSON without any explanation or comments.
        """
    elif document_type == "invoice":
        system_instruction = """
        You are an expert in converting invoice data from markdown to structured JSON.
        Create a JSON object with these fields:
        - invoice_info: object with invoice_number, issue_date, due_date
        - vendor: object with name, address, contact, tax_id
        - customer: object with name, address, contact
        - items: array of objects with description, quantity, unit_price, total
        - totals: object with subtotal, tax, discount, total_amount
        - payment: object with terms, instructions, methods
        - additional_info: any other relevant information
        
        Ensure all numeric values (prices, quantities, totals) are converted to actual numbers, not strings.
        Provide ONLY valid JSON without any explanation or comments.
        """
    else:
        system_instruction = """
        You are an expert in converting document data from markdown to structured JSON.
        Create a well-structured JSON object that accurately represents all the information
        in the markdown document while maintaining logical grouping of related information.
        
        Provide ONLY valid JSON without any explanation or comments.
        """
    
    try:
        # เรียกใช้ OpenAI API
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": markdown_content}
                ],
                "response_format": {"type": "json_object"}
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            if "choices" in result and len(result["choices"]) > 0:
                json_content = result["choices"][0]["message"]["content"]
                # แปลง JSON string เป็น dict
                try:
                    return json.loads(json_content)
                except json.JSONDecodeError as e:
                    return {
                        "error": f"Invalid JSON from OpenAI: {str(e)}",
                        "content": json_content
                    }
            else:
                return {"error": "No content in OpenAI response"}
        else:
            return {
                "error": f"OpenAI API Error: {response.status_code}",
                "details": response.text
            }
    
    except Exception as e:
        return {"error": f"Error calling OpenAI API: {str(e)}"}

if __name__ == "__main__":
    # สำหรับทดสอบ
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        if os.path.exists(file_path):
            with open(file_path, "rb") as f:
                file_bytes = f.read()
            result = process_document(file_bytes, "invoice")
            print(result) 