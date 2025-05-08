# Simple PowerShell Test script for Ingestion Service
# Make sure to have a PDF file to test with

# Set variables
$SERVER_URL = "http://localhost:5000"
$PDF_FILE = ".\test.pdf" # Change this to the path of your test PDF file

# Health check
Write-Host "Checking server health..."
curl.exe -s "${SERVER_URL}/health"
Write-Host "`n"

# Upload file
Write-Host "Uploading test PDF file..."
curl.exe -s -X POST "${SERVER_URL}/api/v1/documents" -F "file=@${PDF_FILE}" -H "Content-Type: multipart/form-data"

Write-Host "`nTest completed." 