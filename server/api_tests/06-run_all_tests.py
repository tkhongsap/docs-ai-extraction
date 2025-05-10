#!/usr/bin/env python
"""
API Test Runner

This script runs all the API tests in the api_tests directory and
generates a consolidated report.
"""
import os
import sys
import importlib.util
import subprocess
import json
from datetime import datetime
from colorama import init, Fore, Style

# Initialize colorama for colored terminal output
init()

def log_header(message):
    print(f"\n{Fore.CYAN}{'=' * 80}{Style.RESET_ALL}")
    print(f"{Fore.CYAN}{message.center(80)}{Style.RESET_ALL}")
    print(f"{Fore.CYAN}{'=' * 80}{Style.RESET_ALL}")

def log_success(message):
    print(f"{Fore.GREEN}[OK] {message}{Style.RESET_ALL}")

def log_error(message):
    print(f"{Fore.RED}[ERROR] {message}{Style.RESET_ALL}")

def log_info(message):
    print(f"{Fore.BLUE}ℹ {message}{Style.RESET_ALL}")

def run_test_file(file_path):
    """Run a specific test file and return the result"""
    file_name = os.path.basename(file_path)
    log_info(f"Running {file_name}...")
    
    try:
        result = subprocess.run(
            [sys.executable, file_path],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Print output
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(f"{Fore.YELLOW}{result.stderr}{Style.RESET_ALL}")
            
        success = result.returncode == 0
        if success:
            log_success(f"{file_name} - PASSED")
        else:
            log_error(f"{file_name} - FAILED (Exit code: {result.returncode})")
            
        return {
            "file": file_name,
            "success": success,
            "exit_code": result.returncode,
            "stdout_length": len(result.stdout),
            "stderr_length": len(result.stderr),
        }
    
    except Exception as e:
        log_error(f"Error running {file_name}: {str(e)}")
        return {
            "file": file_name,
            "success": False,
            "error": str(e)
        }

def get_test_files():
    """Get all test files in the api_tests directory"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    test_files = [
        os.path.join(current_dir, f) 
        for f in os.listdir(current_dir) 
        if any([
            f.startswith("test_"),  # Original pattern
            (f[0:2].isdigit() and "-test_" in f),  # Pattern like "03-test_all_endpoints.py"
            (f[0:2].isdigit() and f.endswith(".py") and "test" in f)  # Any numbered file with "test" in the name
        ]) 
        and f.endswith('.py') 
        and f != os.path.basename(__file__)
        and "00-" not in f  # Skip helper files
        and "01-" not in f  # Skip helper files
    ]
    
    # Sort by the numeric prefix
    test_files.sort()
    return test_files

def run_all_tests():
    """Run all test files and generate a report"""
    log_header("API TEST RUNNER")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Get all test files
    test_files = get_test_files()
    
    if not test_files:
        log_error("No test files found! Make sure files match the expected naming patterns.")
        log_info("Looking for files that:")
        log_info("- Start with 'test_'")
        log_info("- Start with digits and contain '-test_'")
        log_info("- Start with digits, end with '.py', and contain 'test'")
        return False
    
    log_info(f"Found {len(test_files)} test files:")
    for f in test_files:
        log_info(f"  - {os.path.basename(f)}")
    
    # Initialize results
    results = []
    passed = 0
    failed = 0
    
    # Run each test file
    print("\n")
    for test_file in test_files:
        result = run_test_file(test_file)
        results.append(result)
        if result.get("success", False):
            passed += 1
        else:
            failed += 1
        print("\n")
    
    # Generate summary
    log_header("TEST SUMMARY")
    print(f"Test run completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Total test files: {len(test_files)}")
    print(f"Passed: {Fore.GREEN}{passed}{Style.RESET_ALL}")
    print(f"Failed: {Fore.RED}{failed}{Style.RESET_ALL}")
    
    # List failed tests
    if failed > 0:
        print(f"\n{Fore.RED}Failed tests:{Style.RESET_ALL}")
        for result in results:
            if not result.get("success", False):
                print(f"  - {result['file']}")
    
    # Save report
    report = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": len(test_files),
        "passed": passed,
        "failed": failed,
        "details": results
    }
    
    report_path = os.path.join(os.path.dirname(__file__), "test_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    
    log_info(f"Report saved to: {report_path}")
    
    # Return success if all tests passed
    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1) 