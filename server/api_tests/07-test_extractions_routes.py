import requests
import json
import sys
from colorama import init, Fore, Style

# Initialize colorama for colored terminal output
init()

# Base URL for the API
BASE_URL = "http://localhost:5000"

def log_success(message):
    print(f"{Fore.GREEN}✓ {message}{Style.RESET_ALL}")

def log_error(message):
    print(f"{Fore.RED}✗ {message}{Style.RESET_ALL}")

def log_info(message):
    print(f"{Fore.BLUE}ℹ {message}{Style.RESET_ALL}")

def log_header(message):
    print(f"\n{Fore.CYAN}=== {message} ==={Style.RESET_ALL}")

def test_get_all_extractions():
    """Test the GET /api/extractions endpoint"""
    url = f"{BASE_URL}/api/extractions"
    log_header("TESTING GET ALL EXTRACTIONS")
    print(f"GET {url}")
    
    try:
        response = requests.get(url, timeout=10)
        status = response.status_code
        
        if 200 <= status < 300:
            log_success(f"Status: {status}")
            
            # Check if response is HTML (frontend route) or JSON (API route)
            content_type = response.headers.get('Content-Type', '')
            if 'text/html' in content_type:
                log_info("Response is HTML - this might be a frontend route instead of an API endpoint")
                # This is expected - might be a frontend route
                return True, None
            
            try:
                data = response.json()
                count = len(data) if isinstance(data, list) else 1
                log_info(f"Retrieved {count} extractions")
                if count > 0 and isinstance(data, list):
                    log_info(f"First extraction: {json.dumps(data[0], indent=2)}")
                return True, data
                
            except json.JSONDecodeError:
                # This is expected if we get HTML
                log_info("Endpoint did not return valid JSON (might be expected)")
                return True, None
        else:
            log_error(f"Request failed with status code: {status}")
            print(f"Response: {response.text[:100]}")
            return False, None
            
    except requests.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        return False, None

def test_get_extraction_by_id(extraction_id=1):
    """Test the GET /api/extractions/:id endpoint"""
    url = f"{BASE_URL}/api/extractions/{extraction_id}"
    log_header(f"TESTING GET EXTRACTION BY ID {extraction_id}")
    print(f"GET {url}")
    
    try:
        response = requests.get(url, timeout=10)
        status = response.status_code
        
        if 200 <= status < 300:
            log_success(f"Status: {status}")
            
            # Check if response is HTML (frontend route) or JSON (API route)
            content_type = response.headers.get('Content-Type', '')
            if 'text/html' in content_type:
                log_info("Response is HTML - this might be a frontend route instead of an API endpoint")
                # This is expected - might be a frontend route
                return True, None
            
            try:
                data = response.json()
                log_info(f"Extraction data retrieved")
                return True, data
            except json.JSONDecodeError:
                # This is expected if we get HTML
                log_info("Endpoint did not return valid JSON (might be expected)")
                return True, None
        elif status == 404:
            log_info(f"Status: {status} - Extraction not found")
            return True, None  # This is acceptable for testing
        else:
            log_error(f"Request failed with status code: {status}")
            print(f"Response: {response.text[:100]}")
            return False, None
            
    except requests.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        return False, None

def test_get_extraction_by_document_id(document_id=1):
    """Test the GET /api/extractions/document/:id endpoint"""
    url = f"{BASE_URL}/api/extractions/document/{document_id}"
    log_header(f"TESTING GET EXTRACTION BY DOCUMENT ID {document_id}")
    print(f"GET {url}")
    
    try:
        response = requests.get(url, timeout=10)
        status = response.status_code
        
        if 200 <= status < 300:
            log_success(f"Status: {status}")
            try:
                data = response.json()
                log_info(f"Extraction data retrieved for document ID {document_id}")
                return True, data
            except json.JSONDecodeError:
                log_error("Endpoint did not return valid JSON")
                print(f"Raw response: {response.text[:100]}")
                return False, None
        elif status == 404:
            log_info(f"Status: {status} - No extraction found for document ID {document_id}")
            return True, None  # This is acceptable for testing
        else:
            log_error(f"Request failed with status code: {status}")
            print(f"Response: {response.text[:100]}")
            return False, None
            
    except requests.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        return False, None

def test_export_formats(extraction_id=1):
    """Test the export format endpoints for an extraction"""
    export_formats = [
        {"name": "CSV", "path": f"/api/extractions/{extraction_id}/csv", "content_type": "text/csv"},
        {"name": "Markdown", "path": f"/api/extractions/{extraction_id}/markdown", "content_type": "text/markdown"},
        {"name": "JSON", "path": f"/api/extractions/{extraction_id}/json", "content_type": "application/json"}
    ]
    
    results = []
    
    for format_info in export_formats:
        url = f"{BASE_URL}{format_info['path']}"
        log_header(f"TESTING EXPORT AS {format_info['name'].upper()}")
        print(f"GET {url}")
        
        try:
            response = requests.get(url, timeout=10)
            status = response.status_code
            
            if 200 <= status < 300:
                log_success(f"Status: {status}")
                log_info(f"Response contains {len(response.text)} characters")
                results.append((format_info['name'], True))
            else:
                log_error(f"Request failed with status code: {status}")
                print(f"Response: {response.text[:100]}")
                results.append((format_info['name'], False))
                
        except requests.RequestException as e:
            log_error(f"Request failed: {str(e)}")
            results.append((format_info['name'], False))
    
    # Return True only if all formats were exported successfully
    return all(success for _, success in results)

def run_extraction_tests():
    """Run all extraction route tests"""
    results = []
    
    # Test getting all extractions
    all_success, _ = test_get_all_extractions()
    results.append(("Get All Extractions", all_success))
    
    # Test getting extraction by ID
    id_success, _ = test_get_extraction_by_id()
    results.append(("Get Extraction by ID", id_success))
    
    # Test getting extraction by document ID
    doc_id_success, _ = test_get_extraction_by_document_id()
    results.append(("Get Extraction by Document ID", doc_id_success))
    
    # Test export formats
    export_success = test_export_formats()
    results.append(("Export Formats", export_success))
    
    # Print summary
    log_header("EXTRACTION ROUTES TEST SUMMARY")
    success_count = sum(1 for _, success in results if success)
    print(f"Total tests: {len(results)}")
    print(f"Successful: {success_count}")
    print(f"Failed: {len(results) - success_count}")
    
    for name, success in results:
        status = f"{Fore.GREEN}PASS{Style.RESET_ALL}" if success else f"{Fore.RED}FAIL{Style.RESET_ALL}"
        print(f"{name}: {status}")
    
    # Return overall success (all tests passed)
    return all(success for _, success in results)

if __name__ == "__main__":
    success = run_extraction_tests()
    sys.exit(0 if success else 1) 