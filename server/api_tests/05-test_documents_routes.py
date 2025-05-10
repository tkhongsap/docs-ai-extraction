import requests
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

def log_header(message):
    print(f"\n{Fore.CYAN}=== {message} ==={Style.RESET_ALL}")

def test_get_all_documents():
    """Test the GET /api/documents endpoint"""
    url = f"{BASE_URL}/api/documents"
    log_header("TESTING GET ALL DOCUMENTS")
    print(f"GET {url}")
    
    try:
        response = requests.get(url, timeout=10)
        status = response.status_code
        
        if 200 <= status < 300:
            log_success(f"Status: {status}")
            
            try:
                data = response.json()
                document_count = len(data)
                log_info(f"Retrieved {document_count} documents")
                log_info(f"First document: {json.dumps(data[0], indent=2) if document_count > 0 else 'None'}")
                return True, data
                
            except json.JSONDecodeError:
                log_error("Endpoint did not return valid JSON")
                print(f"Raw response: {response.text[:100]}")
                return False, None
        else:
            log_error(f"Request failed with status code: {status}")
            print(f"Response: {response.text[:100]}")
            return False, None
            
    except requests.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        return False, None

def test_get_document_by_id(document_id=1):
    """Test the GET /api/documents/:id endpoint"""
    url = f"{BASE_URL}/api/documents/{document_id}"
    log_header(f"TESTING GET DOCUMENT BY ID {document_id}")
    print(f"GET {url}")
    
    try:
        response = requests.get(url, timeout=10)
        status = response.status_code
        
        if 200 <= status < 300:
            log_success(f"Status: {status}")
            
            try:
                data = response.json()
                log_info(f"Response: {json.dumps(data, indent=2)}")
                
                # Validate document structure
                assert "id" in data, "Missing 'id' field in document"
                assert data["id"] == document_id, f"Document ID mismatch: {data['id']} != {document_id}"
                assert "originalFilename" in data, "Missing 'originalFilename' field"
                assert "fileSize" in data, "Missing 'fileSize' field"
                assert "status" in data, "Missing 'status' field"
                
                log_success("Document structure is valid")
                return True, data
                
            except json.JSONDecodeError:
                log_error("Endpoint did not return valid JSON")
                print(f"Raw response: {response.text[:100]}")
                return False, None
            except AssertionError as e:
                log_error(f"Document validation failed: {str(e)}")
                return False, None
        else:
            log_error(f"Request failed with status code: {status}")
            print(f"Response: {response.text[:100]}")
            return False, None
            
    except requests.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        return False, None

def test_get_next_document(current_id=1):
    """Test the GET /api/documents/next/:id endpoint"""
    url = f"{BASE_URL}/api/documents/next/{current_id}"
    log_header(f"TESTING GET NEXT DOCUMENT AFTER ID {current_id}")
    print(f"GET {url}")
    
    try:
        response = requests.get(url, timeout=10)
        status = response.status_code
        
        # For this endpoint, 404 is acceptable if no next document is found
        if 200 <= status < 300:
            log_success(f"Status: {status}")
            
            try:
                data = response.json()
                log_info(f"Response: {json.dumps(data, indent=2)}")
                log_success("Successfully retrieved next document")
                return True, data
            except json.JSONDecodeError:
                log_error("Endpoint did not return valid JSON")
                print(f"Raw response: {response.text[:100]}")
                return False, None
        elif status == 404:
            log_info(f"Status: {status} - No more documents to review")
            return True, None  # This is an acceptable response
        else:
            log_error(f"Request failed with status code: {status}")
            print(f"Response: {response.text[:100]}")
            return False, None
            
    except requests.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        return False, None

def test_delete_document(document_id=999):
    """Test the DELETE /api/documents/:id endpoint
    By default, uses a non-existent ID to avoid accidentally deleting real data"""
    url = f"{BASE_URL}/api/documents/{document_id}"
    log_header(f"TESTING DELETE DOCUMENT ID {document_id}")
    print(f"DELETE {url}")
    
    try:
        response = requests.delete(url, timeout=10)
        status = response.status_code
        
        # For a delete operation, 204 (No Content) is success, 404 is acceptable for non-existent ID
        if status == 204:
            log_success(f"Status: {status} - Document successfully deleted")
            return True
        elif status == 404:
            log_info(f"Status: {status} - Document not found (expected for test ID)")
            return True  # This is an acceptable response for our test
        else:
            log_error(f"Request failed with status code: {status}")
            print(f"Response: {response.text[:100] if response.text else 'No response body'}")
            return False
            
    except requests.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        return False

def run_document_tests():
    """Run all document route tests"""
    results = []
    
    # Test getting all documents
    all_success, documents = test_get_all_documents()
    results.append(("Get All Documents", all_success))
    
    # Test getting document by ID
    id_success, document = test_get_document_by_id()
    results.append(("Get Document by ID", id_success))
    
    # Test getting next document
    next_success, _ = test_get_next_document()
    results.append(("Get Next Document", next_success))
    
    # Commented out to avoid accidental deletion
    # delete_success = test_delete_document()
    # results.append(("Delete Document", delete_success))
    
    # Print summary
    log_header("DOCUMENT ROUTES TEST SUMMARY")
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
    success = run_document_tests()
    sys.exit(0 if success else 1) 