"""
OpenAI OCR Service Module

This module handles document OCR processing using OpenAI's vision capability.
"""

import os
import json
import base64
from dotenv import load_dotenv
import openai

# Load environment variables
load_dotenv(override=True)

# Get API key from environment
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

# Set the API key for the OpenAI client
openai.api_key = OPENAI_API_KEY

def extract_invoice_data(file_content, content_type):
    """
    Use OpenAI API to extract data from an invoice image
    
    Args:
        file_content: The content of the file (image or PDF)
        content_type: The MIME type of the content (e.g., image/jpeg)
        
    Returns:
        The extracted data in text format (JSON string)
    """
    if not OPENAI_API_KEY:
        raise ValueError("OpenAI API key not found in environment variables")
    
    # Convert binary content to base64
    encoded_content = base64.b64encode(file_content).decode('utf-8')
    
    # Create prompt with detailed invoice extraction instructions
    prompt = """
    Extract all invoice information from this document. The extracted information should be organized in the following JSON format:
    {
        "vendorName": "Company Name",
        "vendorAddress": "Full address",
        "vendorContact": "Phone, email, or website",
        "clientName": "Client name",
        "clientAddress": "Client address",
        "invoiceNumber": "INV-12345",
        "invoiceDate": "YYYY-MM-DD",
        "dueDate": "YYYY-MM-DD",
        "totalAmount": 1234.56,
        "subtotalAmount": 1000.00,
        "taxAmount": 234.56,
        "currency": "USD",
        "lineItems": [
            {
                "description": "Item description",
                "quantity": 2,
                "unitPrice": 500.00,
                "amount": 1000.00,
                "itemCode": "IT-001"
            }
        ],
        "handwrittenNotes": [
            {
                "text": "Handwritten note content",
                "confidence": 80
            }
        ]
    }
    
    Make sure to:
    1. Extract all line items with their details
    2. Identify any handwritten notes or annotations
    3. Provide numeric values without currency symbols
    4. Format dates in ISO format (YYYY-MM-DD)
    5. Include empty arrays if no line items or notes are present
    6.If any item was crossed out but replaced with a handwritten correction, use the new corrected value and exclude the crossed-out version
    
    This document may be entirely or partially in Thai or English, and it may contain handwritten text. Carefully extract the information, ignoring any crossed-out or struck-through items
    Return ONLY the JSON with no additional text.
    """
    
    try:
        # Set a timeout for the API call to prevent hanging requests
        # Default timeout of 60 seconds for image processing (which can take longer than text)
        timeout = 60
        
        try:
            print(f"Making request to OpenAI API with {timeout}s timeout...")
            
            # Call the OpenAI API with the image and timeout
            response = openai.chat.completions.create(
                model="gpt-4.1",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{content_type};base64,{encoded_content}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=2000,
                timeout=timeout
            )
        except Exception as api_error:
            print(f"OpenAI API call error: {str(api_error)}")
            if "timeout" in str(api_error).lower():
                raise TimeoutError(f"OpenAI API request timed out after {timeout} seconds")
            raise
        
        # Detailed response debugging
        print(f"OpenAI response object type: {type(response)}")
        print(f"OpenAI response attributes: {dir(response)[:20]}...")
        print(f"OpenAI response representation: {repr(response)[:200]}...")
        
        # Get the response text
        if not response.choices or not response.choices[0].message.content:
            print("WARNING: Empty response from OpenAI")
            return json.dumps({
                "vendorName": "Could not extract vendor name",
                "invoiceNumber": "Unknown",
                "totalAmount": 0,
                "lineItems": [],
                "handwrittenNotes": [],
                "error": "Empty response from OpenAI"
            })
            
        # Log the raw response content for debugging
        raw_content = response.choices[0].message.content
        print(f"OpenAI raw response full: {raw_content}")
        print(f"OpenAI raw response type: {type(raw_content)}")
        print(f"OpenAI raw response first 100 chars: {raw_content[:100]}...")
        
        result = raw_content.strip()
        
        # Enhanced JSON extraction logic
        # First try to find JSON within markdown code blocks
        import re
        json_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
        json_matches = re.findall(json_pattern, result)
        
        if json_matches:
            # Use the first JSON block found
            result = json_matches[0].strip()
        else:
            # Try to find JSON with opening/closing braces if no code blocks found
            brace_pattern = r'(\{[\s\S]*\})'
            brace_matches = re.findall(brace_pattern, result)
            if brace_matches:
                result = brace_matches[0].strip()
            else:
                # No JSON found
                result = result.strip()
        
        # Additional cleanup to ensure we have valid JSON
        if result.startswith('```'):
            result = result.lstrip('`')
        if result.endswith('```'):
            result = result.rstrip('`')
        
        # Validate JSON format
        try:
            # Log the response for debugging
            print("Extracted JSON candidate:", result[:100] + "..." if len(result) > 100 else result)
            parsed_json = json.loads(result)
            
            # Ensure we have the minimum required fields
            required_fields = ["vendorName", "invoiceNumber", "totalAmount"]
            missing_fields = [field for field in required_fields if field not in parsed_json]
            
            if missing_fields:
                print(f"JSON missing required fields: {missing_fields}")
                # Add missing fields with default values
                for field in missing_fields:
                    if field == "totalAmount":
                        parsed_json[field] = 0
                    else:
                        parsed_json[field] = "Unknown"
            
            # Ensure lineItems and handwrittenNotes exist
            if "lineItems" not in parsed_json:
                parsed_json["lineItems"] = []
            if "handwrittenNotes" not in parsed_json:
                parsed_json["handwrittenNotes"] = []
                
            return json.dumps(parsed_json)
            
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {str(e)}")
            # If not valid JSON, create a basic JSON structure
            return json.dumps({
                "vendorName": "Could not extract vendor name",
                "invoiceNumber": "Unknown",
                "totalAmount": 0,
                "lineItems": [],
                "handwrittenNotes": [],
                "error": f"Failed to parse JSON from OpenAI response: {str(e)}"
            })
        
    except TimeoutError as e:
        print(f"OpenAI API request timed out: {str(e)}")
        return json.dumps({
            "vendorName": "",
            "invoiceNumber": "",
            "totalAmount": 0,
            "lineItems": [],
            "handwrittenNotes": [],
            "error": str(e)
        })
    except openai.APIConnectionError as e:
        print(f"OpenAI API connection error: {str(e)}")
        return json.dumps({
            "vendorName": "",
            "invoiceNumber": "",
            "totalAmount": 0,
            "lineItems": [],
            "handwrittenNotes": [],
            "error": f"Failed to connect to OpenAI API: {str(e)}"
        })
    except openai.RateLimitError as e:
        print(f"OpenAI API rate limit exceeded: {str(e)}")
        return json.dumps({
            "vendorName": "",
            "invoiceNumber": "",
            "totalAmount": 0,
            "lineItems": [],
            "handwrittenNotes": [],
            "error": "OpenAI API rate limit exceeded. Please try again later."
        })
    except openai.APIError as e:
        print(f"OpenAI API error: {str(e)}")
        return json.dumps({
            "vendorName": "",
            "invoiceNumber": "",
            "totalAmount": 0,
            "lineItems": [],
            "handwrittenNotes": [],
            "error": f"OpenAI API error: {str(e)}"
        })
    except Exception as e:
        error_message = str(e)
        print(f"Unexpected error when processing with OpenAI: {error_message}")
        return json.dumps({
            "vendorName": "",
            "invoiceNumber": "",
            "totalAmount": 0,
            "lineItems": [],
            "handwrittenNotes": [],
            "error": f"Error processing document with OpenAI: {error_message}"
        })