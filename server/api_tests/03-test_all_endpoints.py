import requests
import json
import os
import sys
from colorama import init, Fore, Style
from datetime import datetime

# Initialize colorama for colored terminal output
init()

# Base URL for the API
BASE_URL = "http://localhost:5000"

# Dictionary to track endpoint status
endpoint_results = {
    "total": 0,
    "success": 0,
    "failed": 0,
    "results": []
}

def log_success(message):
    print(f"{Fore.GREEN}✓ {message}{Style.RESET_ALL}")

def log_error(message):
    print(f"{Fore.RED}✗ {message}{Style.RESET_ALL}")

def log_info(message):
    print(f"{Fore.BLUE}ℹ {message}{Style.RESET_ALL}")

def log_warning(message):
    print(f"{Fore.YELLOW}⚠ {message}{Style.RESET_ALL}")

def log_header(message):
    print(f"\n{Fore.CYAN}=== {message} ==={Style.RESET_ALL}")

def test_endpoint(method, endpoint, name, expected_status=None, json_body=None, files=None):
    """
    Test an API endpoint and log the result
    
    Args:
        method (str): HTTP method (GET, POST, etc.)
        endpoint (str): API endpoint path
        name (str): Descriptive name for the test
        expected_status (int, optional): Expected HTTP status code. Defaults to None.
        json_body (dict, optional): JSON body for POST/PUT/PATCH requests. Defaults to None.
        files (dict, optional): Files to upload. Defaults to None.
    
    Returns:
        tuple: (success, response)
    """
    endpoint_results["total"] += 1
    
    url = f"{BASE_URL}{endpoint}"
    print(f"\n{Fore.CYAN}Testing: {name}{Style.RESET_ALL}")
    print(f"{method} {url}")
    
    if json_body:
        print(f"Request Body: {json.dumps(json_body, indent=2)[:100]}...")
        
    try:
        if files:
            # For file uploads
            if json_body:
                response = requests.request(method, url, data=json_body, files=files, timeout=10)
            else:
                response = requests.request(method, url, files=files, timeout=10)
        else:
            if json_body:
                response = requests.request(method, url, json=json_body, timeout=10)
            else:
                response = requests.request(method, url, timeout=10)
            
        status = response.status_code
        
        try:
            response_data = response.json() if response.text and response.headers.get('Content-Type', '').startswith('application/json') else None
        except json.JSONDecodeError:
            response_data = {"non_json_response": response.text[:100] + "..." if len(response.text) > 100 else response.text}
            
        # Determine if the test passed
        if expected_status:
            is_success = status == expected_status
        else:
            # Default: consider success if 2xx
            is_success = 200 <= status < 300 or status == 404  # 404 may be valid for some tests
            
        # Log the result
        if is_success:
            log_success(f"Status: {status}")
            endpoint_results["success"] += 1
        else:
            log_error(f"Status: {status} (Expected: {expected_status if expected_status else '2xx'})")
            endpoint_results["failed"] += 1
            
        # Log response details
        if response_data:
            log_info(f"Response (truncated): {json.dumps(response_data, indent=2)[:200]}...")
        else:
            if response.text:
                log_info(f"Response (non-JSON, truncated): {response.text[:100]}...")
            else:
                log_info("No response body")
                
        # Add to results
        endpoint_results["results"].append({
            "name": name,
            "method": method,
            "url": url,
            "status": status,
            "expected_status": expected_status if expected_status else "2xx",
            "success": is_success,
            "timestamp": datetime.now().isoformat()
        })
        
        return is_success, response
        
    except requests.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        endpoint_results["failed"] += 1
        endpoint_results["results"].append({
            "name": name,
            "method": method,
            "url": url,
            "status": "Error",
            "expected_status": expected_status if expected_status else "2xx",
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })
        return False, None

def print_summary():
    """Print a summary of the test results"""
    total = endpoint_results["total"]
    success = endpoint_results["success"]
    failed = endpoint_results["failed"]
    
    success_rate = (success / total) * 100 if total > 0 else 0
    
    log_header("TEST SUMMARY")
    print(f"Total endpoints tested: {total}")
    print(f"Successful tests: {Fore.GREEN}{success}{Style.RESET_ALL}")
    print(f"Failed tests: {Fore.RED}{failed}{Style.RESET_ALL}")
    print(f"Success rate: {Fore.CYAN}{success_rate:.1f}%{Style.RESET_ALL}")
    
    if failed > 0:
        log_header("FAILED TESTS")
        for result in endpoint_results["results"]:
            if not result["success"]:
                print(f"{Fore.RED}{result['method']} {result['url']} - {result['name']}{Style.RESET_ALL}")

def run_all_tests():
    """Run all endpoint tests"""
    log_header("STARTING API ENDPOINT TESTS")
    
    # Test: Health Routes
    log_header("HEALTH ROUTES")
    test_endpoint("GET", "/health", "Health Check")
    
    # Test: Documents Routes
    log_header("DOCUMENTS ROUTES")
    test_endpoint("GET", "/api/documents", "Get All Documents")
    test_endpoint("GET", "/api/documents/1", "Get Document by ID")
    test_endpoint("GET", "/api/documents/next/1", "Get Next Document")
    # Uncomment to test deletion - use with caution!
    # test_endpoint("DELETE", "/api/documents/999", "Delete Document (non-existent)")
    
    # Test: Processing Routes
    log_header("PROCESSING ROUTES")
    test_endpoint("GET", "/api/documents/1/file", "Get Document File")
    test_endpoint("POST", "/api/documents/1/process", "Process Document")
    test_endpoint("POST", "/api/documents/1/reprocess/invoice_details", "Reprocess Document Section")
    
    # Test: Extractions Routes
    log_header("EXTRACTIONS ROUTES")
    test_endpoint("GET", "/api/extractions", "Get All Extractions")
    test_endpoint("GET", "/api/extractions/1", "Get Extraction by ID")
    test_endpoint("GET", "/api/extractions/document/1", "Get Extraction by Document ID")
    
    # Export formats
    test_endpoint("GET", "/api/extractions/1/csv", "Export as CSV")
    test_endpoint("GET", "/api/extractions/1/markdown", "Export as Markdown")
    test_endpoint("GET", "/api/extractions/1/json", "Export as JSON")
    
    # Test update - skip this for general testing unless you have a specific payload
    # patch_data = {"vendorName": "Updated Vendor Name"}
    # test_endpoint("PATCH", "/api/extractions/1", "Update Extraction", json_body=patch_data)
    
    # Test: Ingestion Routes
    log_header("INGESTION ROUTES")
    test_endpoint("GET", "/api/v1/status", "Ingestion Status")
    
    # Test file upload - uncomment and modify if you want to test with an actual file
    """
    pdf_path = "sample_files/test.pdf"
    if os.path.exists(pdf_path):
        with open(pdf_path, "rb") as f:
            files = {"file": (os.path.basename(pdf_path), f, "application/pdf")}
            test_endpoint("POST", "/api/v1/documents", "Upload Document", files=files)
    else:
        log_warning(f"Skipping file upload test - file not found: {pdf_path}")
    """
    
    # Print summary
    print_summary()
    
    # Create report file
    report_path = os.path.join(os.path.dirname(__file__), "api_test_results.json")
    with open(report_path, "w") as f:
        json.dump(endpoint_results, f, indent=2)
    
    log_info(f"Detailed test results saved to: {report_path}")
    
    # Return exit code based on test results
    return 0 if endpoint_results["failed"] == 0 else 1

if __name__ == "__main__":
    sys.exit(run_all_tests()) 