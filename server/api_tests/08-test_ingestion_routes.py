import requests
import os
import json
import sys
from colorama import init, Fore, Style

# Initialize colorama for colored terminal output
init()

# Base URL for the API
BASE_URL = "http://localhost:5000"

def log_success(message):
    print(f"{Fore.GREEN}[OK] {message}{Style.RESET_ALL}")

def log_error(message):
    print(f"{Fore.RED}[ERROR] {message}{Style.RESET_ALL}")

def log_info(message):
    print(f"{Fore.BLUE}ℹ {message}{Style.RESET_ALL}")

def log_warning(message):
    print(f"{Fore.YELLOW}⚠ {message}{Style.RESET_ALL}")

def log_header(message):
    print(f"\n{Fore.CYAN}=== {message} ==={Style.RESET_ALL}")

def test_ingestion_status():
    """Test the GET /api/v1/status endpoint"""
    url = f"{BASE_URL}/api/v1/status"
    log_header("TESTING INGESTION STATUS")
    print(f"GET {url}")
    
    try:
        response = requests.get(url, timeout=10)
        status = response.status_code
        
        if 200 <= status < 300:
            log_success(f"Status: {status}")
            
            try:
                data = response.json()
                log_info(f"Response: {json.dumps(data, indent=2)}")
                return True, data
            except json.JSONDecodeError:
                # For this endpoint, HTML response may be expected
                log_info("Response appears to be HTML (not JSON)")
                return True, None
        else:
            log_error(f"Request failed with status code: {status}")
            print(f"Response: {response.text[:100]}")
            return False, None
            
    except requests.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        return False, None

def test_ingestion_options():
    """Test the OPTIONS /api/v1/documents endpoint"""
    url = f"{BASE_URL}/api/v1/documents"
    log_header("TESTING INGESTION OPTIONS")
    print(f"OPTIONS {url}")
    
    try:
        response = requests.options(url, timeout=10)
        status = response.status_code
        
        if 200 <= status < 300:
            log_success(f"Status: {status}")
            allowed_methods = response.headers.get('Allow') or response.headers.get('Access-Control-Allow-Methods')
            
            if allowed_methods:
                log_info(f"Allowed methods: {allowed_methods}")
                # Check if POST is allowed (for file upload)
                if 'POST' in allowed_methods:
                    log_success("POST method is allowed (required for file upload)")
                    return True
                else:
                    log_warning("POST method is not explicitly allowed")
                    return False
            else:
                log_warning("No allowed methods specified in response headers")
                return False
        else:
            log_error(f"Request failed with status code: {status}")
            print(f"Response: {response.text[:100]}")
            return False
            
    except requests.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        return False

def test_document_upload(test_file_path=None):
    """Test the POST /api/v1/documents endpoint for file upload
    
    Args:
        test_file_path: Path to a test file for upload. If None, will skip actual upload.
    """
    url = f"{BASE_URL}/api/v1/documents"
    log_header("TESTING DOCUMENT UPLOAD")
    
    if not test_file_path:
        log_warning("No test file provided. Skipping actual upload test.")
        log_info("To test upload, provide a path to a test file.")
        return True, None
    
    if not os.path.exists(test_file_path):
        log_error(f"Test file not found: {test_file_path}")
        return False, None
    
    log_info(f"Using test file: {test_file_path}")
    print(f"POST {url}")
    
    try:
        with open(test_file_path, 'rb') as f:
            file_name = os.path.basename(test_file_path)
            
            # Determine mime type (simple approach)
            mime_type = 'application/pdf'
            if file_name.lower().endswith('.jpg') or file_name.lower().endswith('.jpeg'):
                mime_type = 'image/jpeg'
            elif file_name.lower().endswith('.png'):
                mime_type = 'image/png'
            elif file_name.lower().endswith('.tiff') or file_name.lower().endswith('.tif'):
                mime_type = 'image/tiff'
                
            files = {'file': (file_name, f, mime_type)}
            response = requests.post(url, files=files, timeout=30)  # Longer timeout for upload
            
        status = response.status_code
        
        if status == 201:
            log_success(f"Status: {status} - Document uploaded successfully")
            
            try:
                data = response.json()
                log_info(f"Response: {json.dumps(data, indent=2)}")
                
                # Validate response
                assert 'id' in data, "Missing 'id' field in response"
                assert 'originalFilename' in data, "Missing 'originalFilename' field in response"
                assert data['originalFilename'] == file_name, f"Filename mismatch: {data['originalFilename']} != {file_name}"
                
                log_success("Document upload response is valid")
                return True, data
            except json.JSONDecodeError:
                log_error("Response is not valid JSON")
                print(f"Raw response: {response.text[:100]}")
                return False, None
            except AssertionError as e:
                log_error(f"Response validation failed: {str(e)}")
                return False, None
        else:
            log_error(f"Upload failed with status code: {status}")
            print(f"Response: {response.text[:200]}")
            return False, None
            
    except requests.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        return False, None
    except Exception as e:
        log_error(f"Unexpected error: {str(e)}")
        return False, None

def run_ingestion_tests():
    """Run all ingestion route tests"""
    results = []
    
    # Test getting ingestion status
    status_success, _ = test_ingestion_status()
    results.append(("Ingestion Status", status_success))
    
    # Test OPTIONS request
    options_success = test_ingestion_options()
    results.append(("Ingestion Options", options_success))
    
    # Test file upload - disabled by default to avoid creating test files
    # Uncomment and provide a test file path to test upload functionality
    """
    # Look for a test file in a few common locations
    test_file_paths = [
        "sample_files/test.pdf",
        "../sample_files/test.pdf",
        "test.pdf",
        os.path.join(os.path.dirname(__file__), "test.pdf")
    ]
    
    test_file = None
    for path in test_file_paths:
        if os.path.exists(path):
            test_file = path
            break
    
    if test_file:
        upload_success, _ = test_document_upload(test_file)
        results.append(("Document Upload", upload_success))
    else:
        log_warning("No test file found. Skipping upload test.")
    """
    
    # Print summary
    log_header("INGESTION ROUTES TEST SUMMARY")
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
    success = run_ingestion_tests()
    sys.exit(0 if success else 1) 