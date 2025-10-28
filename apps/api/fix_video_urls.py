#!/usr/bin/env python3
"""
Migration script to fix existing video URLs in the database.
Converts localhost URLs to Cloudinary URLs for videos.
"""

import os
import sys
import requests
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import cloudinary
import cloudinary.uploader

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./auraengine.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Cloudinary setup
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET
    )
    print("✅ Cloudinary configured")
else:
    print("❌ Cloudinary not configured")
    sys.exit(1)

def upload_to_cloudinary(url: str, folder: str = "auraengine") -> str:
    """Upload a file to Cloudinary and return the public URL"""
    try:
        result = cloudinary.uploader.upload(url, folder=folder)
        return result['secure_url']
    except Exception as e:
        print(f"❌ Failed to upload to Cloudinary: {e}")
        return url

def fix_video_urls():
    """Fix video URLs in campaign settings"""
    db = SessionLocal()
    
    try:
        # Get all campaigns
        campaigns = db.execute(text("SELECT id, settings FROM campaigns")).fetchall()
        
        print(f"🔍 Found {len(campaigns)} campaigns to check")
        
        fixed_count = 0
        
        for campaign_id, settings_json in campaigns:
            if not settings_json:
                continue
                
            settings = settings_json
            if not isinstance(settings, dict):
                continue
                
            generated_images = settings.get("generated_images", [])
            if not generated_images:
                continue
                
            updated = False
            
            for img_data in generated_images:
                video_url = img_data.get("video_url")
                if video_url and "localhost:8000" in video_url:
                    print(f"🔧 Fixing video URL for campaign {campaign_id}: {video_url[:50]}...")
                    
                    # Upload to Cloudinary
                    new_url = upload_to_cloudinary(video_url, "kling_videos")
                    
                    if new_url != video_url:
                        img_data["video_url"] = new_url
                        updated = True
                        print(f"✅ Updated to: {new_url[:50]}...")
                    else:
                        print(f"⚠️ Failed to upload, keeping original URL")
            
            if updated:
                # Update the campaign settings
                db.execute(
                    text("UPDATE campaigns SET settings = :settings WHERE id = :id"),
                    {"settings": settings, "id": campaign_id}
                )
                fixed_count += 1
                print(f"✅ Updated campaign {campaign_id}")
        
        db.commit()
        print(f"🎉 Migration complete: {fixed_count} campaigns updated")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Starting video URL migration...")
    fix_video_urls()
    print("✅ Migration completed")
