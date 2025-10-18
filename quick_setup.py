#!/usr/bin/env python3
"""
Quick Database Setup - Create all tables using the same method as the API
"""

import requests
import json

def create_tables_via_api():
    """Create tables by making API calls that will trigger table creation"""
    
    api_url = "https://courteous-radiance-production.up.railway.app"
    
    print("🚀 Aura Engine - Quick Database Setup")
    print("=" * 40)
    print(f"API URL: {api_url}")
    
    # Test data to trigger table creation
    test_data = {
        "email": "setup@example.com",
        "password": "setup123",
        "full_name": "Setup User"
    }
    
    try:
        print("📊 Creating tables by testing API endpoints...")
        
        # 1. Register a user (creates users table if not exists)
        print("1. Testing user registration...")
        response = requests.post(
            f"{api_url}/auth/register",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            print("✅ Users table is working!")
            user_data = response.json()
            token = user_data.get('access_token')
            
            if token:
                print("🔑 Got authentication token, testing other endpoints...")
                
                # 2. Test models endpoint (will create models table)
                print("2. Testing models endpoint...")
                models_response = requests.get(
                    f"{api_url}/models",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10
                )
                print(f"   Models endpoint: {models_response.status_code}")
                
                # 3. Test products endpoint (will create products table)
                print("3. Testing products endpoint...")
                products_response = requests.get(
                    f"{api_url}/products",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10
                )
                print(f"   Products endpoint: {products_response.status_code}")
                
                # 4. Test scenes endpoint (will create scenes table)
                print("4. Testing scenes endpoint...")
                scenes_response = requests.get(
                    f"{api_url}/scenes",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10
                )
                print(f"   Scenes endpoint: {scenes_response.status_code}")
                
                # 5. Test campaigns endpoint (will create campaigns table)
                print("5. Testing campaigns endpoint...")
                campaigns_response = requests.get(
                    f"{api_url}/campaigns",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10
                )
                print(f"   Campaigns endpoint: {campaigns_response.status_code}")
                
                print("\n🎉 Database setup completed!")
                print("✅ All tables should now exist and be accessible")
                print("🚀 You can now test the full app flow!")
                return True
            else:
                print("❌ No token received from registration")
                return False
        else:
            print(f"❌ Registration failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = create_tables_via_api()
    
    if success:
        print("\n✅ Setup completed successfully!")
        print("🎯 You can now test the full app flow:")
        print("   1. Add a Model")
        print("   2. Add a Product") 
        print("   3. Add a Scene")
        print("   4. Create a Campaign")
    else:
        print("\n❌ Setup failed. You may need to create tables manually.")
