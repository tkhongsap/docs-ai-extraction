from dotenv import load_dotenv
load_dotenv(override=True)  # บังคับโหลดค่าจากไฟล์ .env ทับค่าเดิม

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import json
import uvicorn
from ms_azure import intel_main
import os
import shutil
from pathlib import Path
import base64
from open_ai import extract_invoice_data
from pdf2image import convert_from_bytes
import tempfile
from mistral import extract_invoice_data_mistral

app = FastAPI(title="เอพีไอสำหรับประมวลผลใบแจ้งหนี้", description="API สำหรับรับไฟล์ใบแจ้งหนี้และประมวลผลด้วย Azure Document Intelligence")

# สร้างโฟลเดอร์ origin ถ้ายังไม่มี
origin_folder = Path("origin")
origin_folder.mkdir(exist_ok=True)

@app.post("/ms-azure-extract-invoice/", response_class=JSONResponse)
async def process_invoice(file: UploadFile = File(...)):
    """
    รับไฟล์ใบแจ้งหนี้และประมวลผลด้วย Azure Document Intelligence
    
    - **file**: ไฟล์ใบแจ้งหนี้ที่ต้องการประมวลผล (รองรับไฟล์รูปภาพหรือ PDF)
    
    **คืนค่า**: ข้อมูลที่สกัดได้จากใบแจ้งหนี้ในรูปแบบ JSON
    """
    try:
        # อ่านเนื้อหาของไฟล์
        file_content = await file.read()
        
        # ตรวจสอบไฟล์ว่าไม่ว่างเปล่า
        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="ไฟล์ว่างเปล่า")
        
        # บันทึกไฟล์ลงในโฟลเดอร์ origin
        file_path = origin_folder / file.filename
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # กลับไปที่จุดเริ่มต้นของไฟล์เพื่ออ่านใหม่
        await file.seek(0)
        file_content = await file.read()
        
        # ประมวลผลไฟล์ด้วย intel_main โดยระบุประเภทเป็น 'invoice'
        result = intel_main(source=file_content, doc_type='invoice')
        
        # แปลงผลลัพธ์เป็น JSON ถ้าจำเป็น
        if isinstance(result, str):
            try:
                result = json.loads(result)
            except json.JSONDecodeError:
                pass  # ถ้าไม่สามารถแปลงเป็น JSON ได้ ให้ส่งคืนในรูปแบบปัจจุบัน
        
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")

@app.post("/openai-extract-invoice")
async def extract_invoice(file: UploadFile = File(...)):
    """
    รับไฟล์รูปภาพหรือ PDF ใบแจ้งหนี้และใช้ OpenAI GPT-4.1 Mini เพื่อแยกข้อมูล
    รองรับการแปลง PDF เป็นรูปภาพอัตโนมัติ
    """
    try:
        # อ่านเนื้อหาของไฟล์
        file_content = await file.read()
        
        # ตรวจสอบไฟล์ว่าไม่ว่างเปล่า
        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="ไฟล์ว่างเปล่า")
        
        # บันทึกไฟล์ลงในโฟลเดอร์ origin
        file_path = origin_folder / file.filename
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # ตรวจสอบว่าเป็นไฟล์ PDF หรือไม่
        content_type = file.content_type
        file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        
        processed_content = file_content
        processed_content_type = content_type
        
        # ถ้าเป็น PDF ให้แปลงเป็นรูปภาพ
        if content_type == 'application/pdf' or file_ext == 'pdf':
            try:
                # แปลงหน้าแรกของ PDF เป็นรูปภาพ
                images = convert_from_bytes(file_content, first_page=1, last_page=1)
                
                if images and len(images) > 0:
                    # สร้างไฟล์ชั่วคราวเพื่อบันทึกรูปภาพ
                    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                        temp_path = temp_file.name
                    
                    # บันทึกรูปภาพแรกลงในไฟล์ชั่วคราว
                    images[0].save(temp_path, 'PNG')
                    
                    # อ่านรูปภาพจากไฟล์ชั่วคราว
                    with open(temp_path, 'rb') as img_file:
                        processed_content = img_file.read()
                    
                    # อัปเดตประเภทเนื้อหา
                    processed_content_type = 'image/png'
                    
                    # ลบไฟล์ชั่วคราว
                    os.unlink(temp_path)
                    
                    # บันทึกรูปภาพที่แปลงแล้วลงในโฟลเดอร์ origin ด้วย
                    converted_img_path = origin_folder / f"{os.path.splitext(file.filename)[0]}_converted.png"
                    with open(converted_img_path, "wb") as f:
                        f.write(processed_content)
                        
                    print(f"แปลง PDF เป็นรูปภาพสำเร็จ: {converted_img_path}")
                else:
                    raise HTTPException(status_code=400, detail="ไม่สามารถแปลง PDF เป็นรูปภาพได้ (ไม่พบหน้าในเอกสาร)")
            except Exception as pdf_err:
                raise HTTPException(status_code=400, detail=f"เกิดข้อผิดพลาดในการแปลง PDF: {str(pdf_err)}")
        
        # เรียกใช้ฟังก์ชันจาก open_ai.py
        extracted_data = extract_invoice_data(processed_content, processed_content_type)
        
        # ลองแปลงข้อมูล JSON จากข้อความที่ได้รับ
        try:
            json_data = json.loads(extracted_data)
            return JSONResponse(content=json_data)
        except json.JSONDecodeError:
            # ถ้าไม่สามารถแปลงเป็น JSON ได้ ให้ส่งคืนข้อความดิบ
            return JSONResponse(content={"result": extracted_data})
        
    except HTTPException:
        raise  # ส่งต่อ HTTPException ที่เกิดขึ้นก่อนหน้านี้
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")

@app.post("/mistral-extract-invoice")
async def extract_invoice_mistral(file: UploadFile = File(...)):
    """
    รับไฟล์รูปภาพหรือ PDF ใบแจ้งหนี้และใช้ Mistral AI เพื่อแยกข้อมูล
    รองรับการแปลง PDF เป็นรูปภาพอัตโนมัติ
    """
    try:
        # อ่านเนื้อหาของไฟล์
        file_content = await file.read()
        
        # ตรวจสอบไฟล์ว่าไม่ว่างเปล่า
        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="ไฟล์ว่างเปล่า")
        
        # บันทึกไฟล์ลงในโฟลเดอร์ origin
        file_path = origin_folder / file.filename
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # ตรวจสอบว่าเป็นไฟล์ PDF หรือไม่
        content_type = file.content_type
        file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        
        processed_content = file_content
        processed_content_type = content_type
        
        # ถ้าเป็น PDF ให้แปลงเป็นรูปภาพ
        if content_type == 'application/pdf' or file_ext == 'pdf':
            try:
                # แปลงหน้าแรกของ PDF เป็นรูปภาพ
                images = convert_from_bytes(file_content, first_page=1, last_page=1)
                
                if images and len(images) > 0:
                    # สร้างไฟล์ชั่วคราวเพื่อบันทึกรูปภาพ
                    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                        temp_path = temp_file.name
                    
                    # บันทึกรูปภาพแรกลงในไฟล์ชั่วคราว
                    images[0].save(temp_path, 'PNG')
                    
                    # อ่านรูปภาพจากไฟล์ชั่วคราว
                    with open(temp_path, 'rb') as img_file:
                        processed_content = img_file.read()
                    
                    # อัปเดตประเภทเนื้อหา
                    processed_content_type = 'image/png'
                    
                    # ลบไฟล์ชั่วคราว
                    os.unlink(temp_path)
                    
                    # บันทึกรูปภาพที่แปลงแล้วลงในโฟลเดอร์ origin ด้วย
                    converted_img_path = origin_folder / f"{os.path.splitext(file.filename)[0]}_converted.png"
                    with open(converted_img_path, "wb") as f:
                        f.write(processed_content)
                        
                    print(f"แปลง PDF เป็นรูปภาพสำเร็จ: {converted_img_path}")
                else:
                    raise HTTPException(status_code=400, detail="ไม่สามารถแปลง PDF เป็นรูปภาพได้ (ไม่พบหน้าในเอกสาร)")
            except Exception as pdf_err:
                raise HTTPException(status_code=400, detail=f"เกิดข้อผิดพลาดในการแปลง PDF: {str(pdf_err)}")
        
        # เรียกใช้ฟังก์ชันจาก mistral.py
        extracted_data = extract_invoice_data_mistral(processed_content, processed_content_type)
        
        # ลองแปลงข้อมูล JSON จากข้อความที่ได้รับ
        try:
            json_data = json.loads(extracted_data)
            return JSONResponse(content=json_data)
        except json.JSONDecodeError:
            # ถ้าไม่สามารถแปลงเป็น JSON ได้ ให้ส่งคืนข้อความดิบ
            return JSONResponse(content={"result": extracted_data})
        
    except HTTPException:
        raise  # ส่งต่อ HTTPException ที่เกิดขึ้นก่อนหน้านี้
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")

@app.get("/")
async def root():
    return {"message": "ยินดีต้อนรับสู่ API ประมวลผลใบแจ้งหนี้ โปรดใช้ /process_invoice/ เพื่ออัปโหลดไฟล์"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 