import os

from dotenv import load_dotenv
from openai import AzureOpenAI
from azure.core.credentials import AzureKeyCredential

load_dotenv()

api_key = os.getenv("AZURE_OPENAI_API_KEY")

client = AzureOpenAI(
    api_version=os.getenv("AZURE_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=api_key
)

print(client)
# Print client attributes
try:
    # Get all attributes of the client object
    client_attributes = dir(client)
    
    # Filter out private attributes (those starting with '_')
    public_attributes = [attr for attr in client_attributes if not attr.startswith('_')]
    
    print("Available public attributes and methods of the AzureOpenAI client:")
    for attr in sorted(public_attributes):
        # Get the attribute value
        try:
            attr_value = getattr(client, attr)
            # Check if it's a method or an attribute
            if callable(attr_value):
                print(f"  - {attr} (method)")
            else:
                print(f"  - {attr} = {attr_value}")
        except Exception as e:
            print(f"  - {attr} (error accessing: {str(e)})")
            
    # You can also inspect specific important attributes
    print("\nClient configuration:")
    print(f"API Version: {client.api_version}")
    print(f"Azure Endpoint: {client.azure_endpoint}")
    
except Exception as e:
    print(f"Error inspecting client attributes: {str(e)}")






