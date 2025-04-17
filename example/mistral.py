import os
import json
import base64
from dotenv import load_dotenv
from instructions import extraction_query
from mistralai import Mistral

# โหลดตัวแปรสภาพแวดล้อม
load_dotenv(override=True)

# ดึง API key จากตัวแปรสภาพแวดล้อม
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")

def extract_invoice_data_mistral(file_content, content_type):
    """
    ใช้ Mistral OCR API เพื่อวิเคราะห์และแยกข้อมูลจากใบแจ้งหนี้
    
    Args:
        file_content (bytes): เนื้อหาของไฟล์ในรูปแบบไบนารี
        content_type (str): ประเภทของไฟล์ เช่น 'image/jpeg', 'image/png', 'application/pdf'
        
    Returns:
        str: ข้อมูลที่สกัดได้ในรูปแบบ JSON string
    """
    # ตรวจสอบ API key
    if not MISTRAL_API_KEY:
        raise ValueError("ไม่พบ MISTRAL_API_KEY ในตัวแปรสภาพแวดล้อม กรุณาตั้งค่าใน .env file")
    
    # สร้าง Mistral Client
    client = Mistral(api_key=MISTRAL_API_KEY)
    
    # เลือกวิธีการประมวลผลตามประเภทไฟล์
    is_pdf = content_type == "application/pdf"
    
    if is_pdf:
        # สำหรับไฟล์ PDF ให้อัปโหลดไฟล์และใช้ OCR API
        # อัปโหลดไฟล์ไปยัง Mistral API
        uploaded_file = client.files.upload(
            file={
                "file_name": "invoice_document.pdf",
                "content": file_content
            },
            purpose="ocr"
        )
        
        # ขอ URL ที่ลงนามแล้วสำหรับไฟล์ที่อัปโหลด
        signed_url = client.files.get_signed_url(file_id=uploaded_file.id)
        
        # ใช้ OCR API เพื่อแยกข้อความจากเอกสาร PDF (method 1: ocr.process)
        ocr_response = client.ocr.process(
            model="mistral-ocr-latest",
            document={
                "type": "document_url",
                "document_url": signed_url.url
            }
        )
        
        # ใช้ LLM เพื่อประมวลผลข้อมูลที่แยกได้ตาม extraction_query (method 2: document understanding)
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": extraction_query
                    },
                    {
                        "type": "document_url",
                        "document_url": signed_url.url
                    }
                ]
            }
        ]
        
        # ใช้โมเดลที่เหมาะสมสำหรับการเข้าใจเอกสาร
        chat_response = client.chat.complete(
            model="mistral-small-latest",  # หรือ mistral-medium-latest ตามความเหมาะสม
            messages=messages
        )
        
        # ลบไฟล์จาก Mistral หลังใช้งานเสร็จ
        try:
            client.files.delete(file_id=uploaded_file.id)
        except:
            pass  # ข้ามการลบหากเกิดข้อผิดพลาด
        
    else:
        # สำหรับรูปภาพ ใช้วิธี OCR with image
        # แปลงไฟล์เป็น base64 string
        base64_image = base64.b64encode(file_content).decode('utf-8')
        data_uri = f"data:{content_type};base64,{base64_image}"
        
        # ใช้ OCR API สำหรับรูปภาพ
        ocr_response = client.ocr.process(
            model="mistral-ocr-latest",
            document={
                "type": "image_url",
                "image_url": data_uri
            }
        )
        
        # ส่งคำถามเพื่อวิเคราะห์เอกสารด้วย LLM
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": extraction_query
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": data_uri
                        }
                    }
                ]
            }
        ]
        
        # ใช้โมเดลที่เหมาะสมสำหรับการเข้าใจเอกสาร
        chat_response = client.chat.complete(
            model="mistral-small-latest",  # หรือ mistral-medium-latest ตามความเหมาะสม
            messages=messages
        )
    
    # รับเนื้อหาของการตอบกลับจาก LLM
    extracted_text = chat_response.choices[0].message.content
    
    return extracted_text
