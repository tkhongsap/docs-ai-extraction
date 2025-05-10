import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

# 1️⃣  Set your endpoint (no trailing slash) and an API key
endpoint   = os.getenv("AZURE_OPENAI_ENDPOINT")
api_key    = os.getenv("AZURE_OPENAI_API_KEY")  # Match the variable name from your other script

# 2️⃣  Pick the API version you want to target
api_version = os.getenv("AZURE_API_VERSION")  # latest preview (if you need preview features)


# 3️⃣  Call the models-list operation
url      = f"{endpoint}/openai/models?api-version={api_version}"
headers  = {"api-key": api_key}

response = requests.get(url, headers=headers, timeout=30)
response.raise_for_status()        # raises if key/endpoint is wrong
print(response.json())


