import os
import base64
from openai import OpenAI
from instructions import extraction_query

# ตั้งค่า OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def extract_invoice_data(file_content, content_type):
    """
    ใช้ OpenAI API เพื่อแยกข้อมูลจากรูปภาพใบแจ้งหนี้
    
    Args:
        file_content: เนื้อหาไฟล์รูปภาพ
        content_type: ประเภทของเนื้อหา (เช่น image/jpeg)
        
    Returns:
        ข้อมูลที่แยกออกมาในรูปแบบข้อความ
    """
    # แปลงไฟล์เป็น base64
    base64_image = base64.b64encode(file_content).decode("utf-8")
    
    # เรียกใช้ OpenAI API ด้วย GPT-4.1 Mini
    response = client.chat.completions.create(
        model="gpt-4.1-mini",  # หรือชื่อ model ที่ถูกต้องตามที่ OpenAI กำหนด
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": extraction_query},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/{content_type};base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        max_tokens=1500
    )
    
    # ดึงข้อมูลจากการตอบกลับ
    return response.choices[0].message.content
