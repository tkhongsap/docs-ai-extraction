#!/bin/bash

# Test script for OCR services
# This script tests all three OCR endpoints with a sample document

echo "=== Testing OCR Services ==="
echo ""

# Define sample document (use an example PDF in uploads directory if it exists)
SAMPLE_DOC=""
if [ -d "./uploads" ] && [ "$(ls -A ./uploads)" ]; then
  # Use the first PDF found in uploads
  SAMPLE_DOC=$(find ./uploads -name "*.pdf" | head -n 1)
fi

if [ -z "$SAMPLE_DOC" ]; then
  echo "No sample documents found. Please upload a PDF document first."
  exit 1
fi

echo "Using sample document: $SAMPLE_DOC"
echo ""

# Function to test an OCR endpoint
test_ocr_endpoint() {
  local endpoint=$1
  local service_name=$2
  
  echo "Testing $service_name OCR service..."
  echo "Endpoint: $endpoint"
  
  # Use curl to send the document to the OCR service
  echo ""
  echo "Response (limited to first 300 characters):"
  RESPONSE=$(curl -s -X POST "$endpoint" -F "file=@$SAMPLE_DOC")
  
  # Extract key fields using grep
  echo "$RESPONSE" | head -c 300
  echo "..."
  
  # Try to extract some key fields
  echo ""
  echo "Key fields:"
  if echo "$RESPONSE" | grep -q "vendorName"; then
    VENDOR_NAME=$(echo "$RESPONSE" | grep -o '"vendorName":"[^"]*"')
    echo "$VENDOR_NAME"
  fi
  
  if echo "$RESPONSE" | grep -q "invoiceNumber"; then
    INVOICE_NUM=$(echo "$RESPONSE" | grep -o '"invoiceNumber":"[^"]*"')
    echo "$INVOICE_NUM"
  fi
  
  if echo "$RESPONSE" | grep -q "totalAmount"; then
    TOTAL=$(echo "$RESPONSE" | grep -o '"totalAmount":[^,}]*')
    echo "$TOTAL"
  fi
  
  echo ""
  echo "$service_name test complete"
  echo "-------------------------------------"
}

# Test all three OCR services
test_ocr_endpoint "http://localhost:5006/openai-ocr" "OpenAI"
test_ocr_endpoint "http://localhost:5006/mistral-ocr" "Mistral AI"
test_ocr_endpoint "http://localhost:5006/ms-azure-ocr" "Azure Document Intelligence"

echo ""
echo "All OCR service tests completed"