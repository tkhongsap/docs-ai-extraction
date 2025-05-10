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

def test_health_endpoint():
    """Test the health check endpoint"""
    url = f"{BASE_URL}/health"
    log_header("TESTING HEALTH CHECK")
    print(f"GET {url}")
    
    try:
        response = requests.get(url, timeout=10)
        status = response.status_code
        
        if 200 <= status < 300:
            log_success(f"Status: {status}")
            
            try:
                data = response.json()
                log_info(f"Response: {json.dumps(data, indent=2)}")
                
                # Validate health response structure
                assert "status" in data, "Missing 'status' field in health response"
                assert data["status"] == "ok", f"Unexpected status value: {data['status']}"
                assert "time" in data, "Missing 'time' field in health response"
                assert "message" in data, "Missing 'message' field in health response"
                assert "service_name" in data, "Missing 'service_name' field in health response"
                assert "build_metadata" in data, "Missing 'build_metadata' field in health response"
                
                log_success("All health check fields are present")
                return True
                
            except json.JSONDecodeError:
                log_error("Health endpoint did not return valid JSON")
                print(f"Raw response: {response.text[:100]}")
                return False
            except AssertionError as e:
                log_error(f"Health check validation failed: {str(e)}")
                return False
        else:
            log_error(f"Health check failed with status code: {status}")
            print(f"Response: {response.text[:100]}")
            return False
            
    except requests.RequestException as e:
        log_error(f"Request to health endpoint failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_health_endpoint()
    sys.exit(0 if success else 1) 