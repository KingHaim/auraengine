#!/usr/bin/env python3
"""
Add a test user to the database for testing purposes
This script will create a test user that you can use to login
"""

import requests
import json

def add_test_user():
    """Add a test user via the API"""
    
    api_url = "https://courteous-radiance-production.up.railway.app"
    
    # Test user data
    user_data = {
        "email": "test@example.com",
        "password": "password123",
        "full_name": "Test User"
    }
    
    print("🚀 Adding test user to Aura Engine...")
    print(f"API URL: {api_url}")
    
    try:
        # Try to register the test user
        response = requests.post(
            f"{api_url}/auth/register",
            json=user_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            print("✅ Test user created successfully!")
            print("📧 Email: test@example.com")
            print("🔑 Password: password123")
            print("\n🎉 You can now test the login functionality!")
            return True
        else:
            print(f"❌ Failed to create test user: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error connecting to API: {e}")
        return False

if __name__ == "__main__":
    success = add_test_user()
    
    if success:
        print("\n✅ Setup completed! Try logging in with:")
        print("   Email: test@example.com")
        print("   Password: password123")
    else:
        print("\n❌ Setup failed. The database tables may not exist yet.")
        print("Please create the database tables first using one of the manual methods.")
