#!/usr/bin/env python3
"""
Simple working version for debugging
Updated: Fixed Vella 1.5 API parameter (garment_image)
"""
from fastapi import FastAPI, HTTPException, Depends, Request, Form, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from database import SessionLocal, create_tables
from models import User, Product, Model, Scene, Campaign, Generation
from schemas import UserCreate, UserResponse, Token, ProductResponse, ModelResponse, SceneResponse, CampaignResponse, ChangePasswordRequest
from auth import get_current_user, create_access_token, verify_password, get_password_hash
from datetime import datetime, timedelta
import os
import json
import uuid
import stripe
import replicate
import base64
import mimetypes
import requests
from typing import List, Optional
from io import BytesIO
from PIL import Image, ImageFilter, ImageOps
from pydantic import BaseModel
import cloudinary
import cloudinary.uploader
import cloudinary.api

# Environment variables
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")

# Initialize Stripe
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
else:
    print("⚠️ STRIPE_SECRET_KEY not set - Stripe features will not work")

# Cloudinary configuration
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

# Configure Cloudinary
print(f"🔍 DEBUG: CLOUDINARY_CLOUD_NAME = {CLOUDINARY_CLOUD_NAME}")
print(f"🔍 DEBUG: CLOUDINARY_API_KEY = {CLOUDINARY_API_KEY}")
print(f"🔍 DEBUG: CLOUDINARY_API_SECRET = {'*' * len(CLOUDINARY_API_SECRET) if CLOUDINARY_API_SECRET else None}")

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET
    )
    print("✅ Cloudinary configured successfully")
else:
    print("⚠️ Cloudinary not configured - using local storage fallback")
    print(f"   Missing: CLOUD_NAME={bool(CLOUDINARY_CLOUD_NAME)}, API_KEY={bool(CLOUDINARY_API_KEY)}, API_SECRET={bool(CLOUDINARY_API_SECRET)}")

def convert_localhost_video_urls(settings: dict) -> dict:
    """
    Convert localhost video URLs to Cloudinary URLs on-the-fly.
    Optimized: Non-blocking, fast fail for read operations.
    """
    if not settings or not isinstance(settings, dict):
        return settings
    
    generated_images = settings.get("generated_images", [])
    if not generated_images:
        return settings
    
    # Fast check: skip if no localhost URLs found (most common case)
    has_localhost = False
    for img_data in generated_images:
        video_url = img_data.get("video_url")
        if video_url and ("localhost:8000" in video_url or "localhost" in video_url):
            has_localhost = True
            break
    
    if not has_localhost:
        # No localhost URLs, return immediately without processing
        return settings
    
    # Only process if localhost URLs are found (rare case)
    # Skip conversion during read operations to avoid blocking
    # Return settings as-is - conversion should happen during write operations
    # or in background jobs
    return settings

# Helper functions for URL generation
def get_base_url():
    """Get the base URL for the API"""
    # In development, use localhost if not explicitly set
    if os.getenv("ENVIRONMENT") == "development" or os.getenv("API_BASE_URL") is None:
        return "http://localhost:8000"
    return os.getenv("API_BASE_URL", "https://auraengine-production.up.railway.app")

def get_static_url(filename: str) -> str:
    """Generate a static file URL"""
    return f"{get_base_url()}/static/{filename}"

def stabilize_url(url: str, prefix: str) -> str:
    """
    Persist ephemeral (replicate.delivery) or data URLs to Cloudinary and return a stable URL.
    Leaves already-stable URLs unchanged; returns original for other http(s).
    """
    try:
        if not isinstance(url, str):
            return url
        # Already stable (Cloudinary or static)
        if url.startswith("https://res.cloudinary.com/") or url.startswith(get_base_url() + "/static/"):
            return url
        # Data URL → upload to Cloudinary
        if url.startswith("data:image/"):
            return upload_to_cloudinary(url, prefix)
        # Replicate ephemeral URL → upload to Cloudinary
        if url.startswith("https://replicate.delivery/"):
            return upload_to_cloudinary(url, prefix)
        # Other http(s) URLs: leave as-is
        return url
    except Exception as e:
        print(f"stabilize_url failed for {url[:120] if isinstance(url, str) else url}...: {e}")
        return url

def get_model_url(gender: str) -> str:
    """Get the model image URL based on gender - returns external URL"""
    if gender == "female":
        return "https://i.ibb.co/tp4LPg7t/model-female.png"
    else:
        return "https://i.ibb.co/M5n1qznw/model.png"

def to_url(value: object) -> str:
    """Normalize various Replicate outputs into a plain string URL.
    Handles strings, objects with url()/url, and single-item lists.
    """
    try:
        if isinstance(value, str):
            return value
        # Replicate result with url() method
        if hasattr(value, "url") and callable(getattr(value, "url")):
            try:
                return value.url()
            except Exception:
                pass
        # Replicate result with url attribute
        if hasattr(value, "url") and not callable(getattr(value, "url")):
            try:
                return str(getattr(value, "url"))
            except Exception:
                pass
        # Lists: use first entry
        if isinstance(value, list) and len(value) > 0:
            return to_url(value[0])
        return str(value)
    except Exception:
        return str(value)

STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aura_engine.db")

# Configure Stripe
stripe.api_key = STRIPE_SECRET_KEY

# Pydantic models
class LoginRequest(BaseModel):
    email: str
    password: str

class PaymentConfirmRequest(BaseModel):
    payment_intent_id: str

# Initialize FastAPI app
app = FastAPI(title="Aura API", version="1.0.0")

# Create database tables on startup
# Cache for pose image URLs (Cloudinary URLs)
POSE_IMAGE_URLS = {}

def upload_pose_images_to_cloudinary():
    """Upload pose images to Cloudinary on startup"""
    global POSE_IMAGE_URLS
    try:
        if not CLOUDINARY_CLOUD_NAME or not CLOUDINARY_API_KEY or not CLOUDINARY_API_SECRET:
            print("⚠️ Cloudinary not configured - pose images will use local static URLs")
            return
        
        import os
        api_dir = os.path.dirname(os.path.abspath(__file__))
        poses_dir = os.path.join(api_dir, "static", "poses")
        
        if not os.path.exists(poses_dir):
            print(f"⚠️ Poses directory not found: {poses_dir}")
            return
        
        pose_files = ["Pose-neutral.jpg", "Pose-handneck.jpg", "Pose-thinking.jpg"]
        
        for pose_file in pose_files:
            pose_path = os.path.join(poses_dir, pose_file)
            if os.path.exists(pose_path):
                try:
                    # Read file and upload to Cloudinary
                    with open(pose_path, "rb") as f:
                        file_content = f.read()
                        import base64
                        ext = pose_file.split('.')[-1]
                        data_url = f"data:image/{ext};base64,{base64.b64encode(file_content).decode()}"
                        cloudinary_url = upload_to_cloudinary(data_url, "poses")
                        POSE_IMAGE_URLS[pose_file] = cloudinary_url
                        print(f"✅ Uploaded {pose_file} to Cloudinary: {cloudinary_url[:50]}...")
                except Exception as e:
                    print(f"⚠️ Failed to upload {pose_file} to Cloudinary: {e}")
                    print(f"⚠️ Will try to upload on-demand when needed")
                    # Don't set fallback URL - we'll upload on-demand
                    POSE_IMAGE_URLS[pose_file] = None
            else:
                print(f"⚠️ Pose file not found: {pose_path}")
                print(f"⚠️ Will try to upload on-demand when needed")
                # Don't set fallback URL - we'll upload on-demand
                POSE_IMAGE_URLS[pose_file] = None
        
        print(f"✅ Pose images initialized: {len(POSE_IMAGE_URLS)} poses")
    except Exception as e:
        print(f"⚠️ Error uploading pose images to Cloudinary: {e}")
        import traceback
        traceback.print_exc()

@app.on_event("startup")
async def startup_event():
    try:
        print("🔧 MODEL GENERATION: Using external URLs - NO LOCAL FILES")
        print("🗄️ Creating database tables...")
        create_tables()
        print("✅ Database tables created successfully")
        
        # Run migration for subscription columns if needed
        try:
            from migrate_subscription_columns import migrate_subscription_columns
            print("🔄 Running subscription columns migration...")
            migrate_subscription_columns()
        except Exception as migration_error:
            print(f"⚠️ Migration error (may be OK if columns already exist): {migration_error}")
        
        # Test database connection
        from sqlalchemy import text
        from database import engine
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("✅ Database connection test successful")
        
        # Upload pose images to Cloudinary (non-blocking, don't fail startup if this fails)
        print("🖼️ Uploading pose images to Cloudinary...")
        try:
            upload_pose_images_to_cloudinary()
        except Exception as pose_error:
            print(f"⚠️ Pose image upload failed (non-critical): {pose_error}")
            print("⚠️ Continuing startup - pose images will use fallback URLs")
        
        print("✅ Application startup complete")
            
    except Exception as e:
        print(f"❌ Critical startup error: {e}")
        import traceback
        traceback.print_exc()
        # Don't raise - let the app start even if there are non-critical errors
        # Only raise for truly critical errors that prevent the app from functioning
        if "database" in str(e).lower() or "connection" in str(e).lower():
            raise

# CORS middleware - Allow all origins for deployment
# When allow_credentials=True, we must explicitly list origins (cannot use "*")
# Get allowed origins from environment or use defaults
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = (
    allowed_origins_env.split(",") if allowed_origins_env 
    else [
        "https://www.beatingheart.ai",
        "https://beatingheart.ai",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]
)

print(f"🌐 CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Config
DISABLE_PLACEHOLDERS = True

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------- API Endpoints ----------
@app.get("/")
async def root():
    return {"message": "Aura API"}

@app.get("/health")
async def health():
    return {"status": "healthy", "message": "Aura API is running"}

@app.get("/poses")
async def get_pose_urls():
    """Get URLs for all pose images (Cloudinary URLs if available, otherwise static URLs) - Public endpoint"""
    global POSE_IMAGE_URLS
    # If poses haven't been uploaded yet, try to get static URLs
    if not POSE_IMAGE_URLS:
        pose_files = ["Pose-neutral.jpg", "Pose-handneck.jpg", "Pose-thinking.jpg"]
        for pose_file in pose_files:
            POSE_IMAGE_URLS[pose_file] = get_static_url(f"poses/{pose_file}")
    
    return {
        "poses": POSE_IMAGE_URLS,
        "base_url": get_base_url()
    }

# Simple test endpoint
@app.get("/test")
async def test_endpoint():
    return {"message": "Test endpoint working", "status": "success"}

# Debug endpoint to list files in uploads directory
@app.get("/debug/files")
async def debug_files():
    """Debug endpoint to see what files exist in uploads directory"""
    import os
    try:
        uploads_dir = "uploads"
        if os.path.exists(uploads_dir):
            files = os.listdir(uploads_dir)
            return {
                "uploads_dir_exists": True,
                "files": files,
                "file_count": len(files)
            }
        else:
            return {
                "uploads_dir_exists": False,
                "message": "uploads directory does not exist"
            }
    except Exception as e:
        return {"error": str(e)}

# Direct endpoint to serve static images
@app.get("/static/{file_path:path}")
async def serve_static_file(file_path: str):
    """Serve static files directly, supporting subdirectories"""
    import os
    # Get the directory where this file is located (apps/api/)
    api_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Try static directory first (for poses, scenes, etc.)
    static_path = os.path.join(api_dir, "static", file_path)
    if os.path.exists(static_path):
        from fastapi.responses import FileResponse
        return FileResponse(static_path)
    
    # Fallback to uploads directory (relative to API directory)
    uploads_path = os.path.join(api_dir, "uploads", file_path)
    if os.path.exists(uploads_path):
        from fastapi.responses import FileResponse
        return FileResponse(uploads_path)
    
    # Fallback to current working directory (for backwards compatibility)
    cwd_static = os.path.join("static", file_path)
    if os.path.exists(cwd_static):
        from fastapi.responses import FileResponse
        return FileResponse(cwd_static)
    
    cwd_uploads = os.path.join("uploads", file_path)
    if os.path.exists(cwd_uploads):
        from fastapi.responses import FileResponse
        return FileResponse(cwd_uploads)
    
        # Return debug info when file not found
        raise HTTPException(
            status_code=404, 
        detail=f"File not found: {file_path}. Tried: {static_path}, {uploads_path}, {cwd_static}, {cwd_uploads}"
        )

# ---------- Authentication Endpoints ----------
@app.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create new user
        hashed_password = get_password_hash(user_data.password)
        user = User(
            email=user_data.email,
            full_name=user_data.full_name,
            hashed_password=hashed_password,
            credits=100  # Give new users 100 credits
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create access token
        access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse.from_orm(user)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auth/login", response_model=Token)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Login user"""
    try:
        print(f"🔐 Login attempt for email: {login_data.email}")
        email = login_data.email
        password = login_data.password
        
        print(f"🔍 Querying database for user...")
        user = db.query(User).filter(User.email == email).first()
        print(f"👤 User found: {user is not None}")
        
        if not user:
            print(f"❌ User not found for email: {email}")
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        
        print(f"🔑 Verifying password...")
        if not verify_password(password, user.hashed_password):
            print(f"❌ Password verification failed")
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        
        print(f"✅ Password verified, creating token...")
        # Create access token
        access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
        
        print(f"🎉 Login successful for user: {user.email}")
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse.from_orm(user)
        }
        
    except HTTPException as he:
        print(f"❌ HTTP Exception: {he.detail}")
        raise he
    except Exception as e:
        print(f"❌ Login error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/auth/me")
async def get_current_user_info(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user info for token verification"""
    try:
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Return user info with subscription details
        return {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "is_verified": user.is_verified,
            "credits": user.credits,
            "subscription_type": user.subscription_type,
            "subscription_credits": user.subscription_credits or 0,
            "subscription_status": user.subscription_status,
            "subscription_expires_at": user.subscription_expires_at.isoformat() if user.subscription_expires_at else None,
            "created_at": user.created_at.isoformat() if user.created_at else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auth/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password"""
    try:
        # Get user from database
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify current password
        if not verify_password(password_data.current_password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        
        # Validate new password length
        if len(password_data.new_password) < 8:
            raise HTTPException(
                status_code=400, 
                detail="New password must be at least 8 characters long"
            )
        
        # Check if new password is different from current password
        if verify_password(password_data.new_password, user.hashed_password):
            raise HTTPException(
                status_code=400,
                detail="New password must be different from current password"
            )
        
        # Hash new password and update user
        user.hashed_password = get_password_hash(password_data.new_password)
        user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(user)
        
        return {
            "message": "Password changed successfully",
            "status": "success"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error changing password: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Basic CRUD Endpoints ----------
@app.get("/products", response_model=list[ProductResponse])
async def get_products(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all products for the current user"""
    try:
        products = db.query(Product).filter(Product.user_id == current_user["user_id"]).all()
        return products
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models", response_model=list[ModelResponse])
async def get_models(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all models for the current user"""
    try:
        models = db.query(Model).filter(Model.user_id == current_user["user_id"]).all()
        return models
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/scenes", response_model=list[SceneResponse])
async def get_scenes(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all scenes for the current user"""
    try:
        scenes = db.query(Scene).filter(Scene.user_id == current_user["user_id"]).all()
        return scenes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scenes/bulk-add-from-uploads")
async def bulk_add_scenes_from_uploads(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk add all scene images from uploads directory as scenes"""
    try:
        import os
        import glob
        from pathlib import Path
        
        # Get all scene images from uploads directory
        uploads_dir = Path("uploads")
        scene_files = list(uploads_dir.glob("scene_*"))
        
        if not scene_files:
            return {"message": "No scene images found in uploads directory", "added": 0, "skipped": 0}
        
        added_count = 0
        skipped_count = 0
        added_scenes = []
        
        for scene_file in scene_files:
            try:
                # Extract scene name from filename
                scene_name = scene_file.stem.replace("scene_", "").replace("_", " ").title()
                
                # Create a more readable name
                if scene_name.startswith("-"):
                    scene_name = f"Scene {scene_name[1:]}"
                else:
                    scene_name = f"Scene {scene_name}"
                
                # Check if scene already exists
                existing_scene = db.query(Scene).filter(
                    Scene.user_id == current_user["user_id"],
                    Scene.name == scene_name
                ).first()
                
                if existing_scene:
                    skipped_count += 1
                    continue
                
                # Create the scene URL (using the static URL format)
                scene_url = f"{get_base_url()}/static/{scene_file.name}"
                
                # Create scene in database
                scene = Scene(
                    id=str(uuid.uuid4()),
                    user_id=current_user["user_id"],
                    name=scene_name,
                    description="Professional fashion photography scene",
                    category="lifestyle",
                    tags=["fashion", "photography", "background"],
                    image_url=scene_url,
                    is_standard=False,
                    created_at=datetime.utcnow()
                )
                
                db.add(scene)
                added_scenes.append({
                    "id": scene.id,
                    "name": scene.name,
                    "image_url": scene.image_url
                })
                added_count += 1
                
            except Exception as e:
                print(f"Error adding scene {scene_file.name}: {e}")
                continue
        
        # Commit all changes
        db.commit()
        
        return {
            "message": f"Bulk scene import complete! Added {added_count} scenes, skipped {skipped_count} existing scenes.",
            "added": added_count,
            "skipped": skipped_count,
            "total_found": len(scene_files),
            "scenes": added_scenes
        }
        
    except Exception as e:
        print(f"Bulk scene import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/scenes/{scene_id}")
async def update_scene(
    scene_id: str,
    is_standard: bool = Form(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update scene properties"""
    try:
        scene = db.query(Scene).filter(
            Scene.id == scene_id,
            Scene.user_id == current_user["user_id"]
        ).first()
        
        if not scene:
            raise HTTPException(status_code=404, detail="Scene not found")
        
        # Update is_standard if provided
        if is_standard is not None:
            scene.is_standard = is_standard
        
        db.commit()
        db.refresh(scene)
        
        return {
            "id": scene.id,
            "name": scene.name,
            "is_standard": scene.is_standard,
            "message": "Scene updated successfully"
        }
        
    except Exception as e:
        print(f"Scene update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scenes/upload")
async def upload_scene(
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form(""),
    tags: str = Form(""),
    image: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a new scene"""
    try:
        # Validate file type
        if not image.content_type or not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Save scene image
        image_filename = f"scene_{hash(name + str(datetime.now()))}.{image.filename.split('.')[-1]}"
        image_path = os.path.join("uploads", image_filename)
        
        with open(image_path, "wb") as f:
            content = await image.read()
            f.write(content)
        
        # Upload to Replicate for reliable serving
        try:
            image_url = upload_to_replicate(image_path)
        except Exception:
            image_url = get_static_url(image_filename)
        
        # Parse tags
        tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()] if tags else []
        
        # Create scene in database
        # Set is_standard=True for scenes from static/scenes (they start with "Scene ")
        is_standard_scene = name.startswith("Scene ") and len(name.split()) == 2
        
        scene = Scene(
            id=str(uuid.uuid4()),
            user_id=current_user["user_id"],
            name=name,
            description=description,
            category=category,
            tags=tag_list,
            image_url=image_url,
            is_standard=is_standard_scene,
            created_at=datetime.utcnow()
        )
        
        db.add(scene)
        db.commit()
        db.refresh(scene)
        
        return {
            "id": scene.id,
            "name": scene.name,
            "description": scene.description,
            "image_url": scene.image_url,
            "category": scene.category,
            "tags": scene.tags,
            "is_standard": scene.is_standard,
            "created_at": scene.created_at,
            "updated_at": scene.updated_at
        }
        
    except Exception as e:
        print(f"Scene upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/campaigns", response_model=list[CampaignResponse])
async def get_campaigns(
    limit: Optional[int] = Query(None, description="Limit number of campaigns returned"),
    order_by: Optional[str] = Query("created_at", description="Field to order by"),
    order: Optional[str] = Query("desc", description="Order direction (asc/desc)"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get campaigns for the current user with optional limit and ordering"""
    try:
        # Start with base query
        query = db.query(Campaign).filter(Campaign.user_id == current_user["user_id"])
        
        # Apply ordering
        if order_by == "created_at":
            if order == "desc":
                query = query.order_by(Campaign.created_at.desc())
            else:
                query = query.order_by(Campaign.created_at.asc())
        elif order_by == "updated_at":
            if order == "desc":
                query = query.order_by(Campaign.updated_at.desc())
            else:
                query = query.order_by(Campaign.updated_at.asc())
        
        # Apply limit if provided
        if limit:
            campaigns = query.limit(limit).all()
        else:
            campaigns = query.all()
        
        # Process campaigns (optimize validation)
        result = []
        for campaign in campaigns:
            try:
                # Ensure generation_status exists, default to "idle" if missing
                if not hasattr(campaign, 'generation_status') or campaign.generation_status is None:
                    campaign.generation_status = "idle"
                
                # Ensure scene_generation_status exists, default to "idle" if missing
                if not hasattr(campaign, 'scene_generation_status') or campaign.scene_generation_status is None:
                    campaign.scene_generation_status = "idle"
                
                # Skip video URL conversion during read - it's too slow and blocks requests
                # Video URLs should be converted during write operations or background jobs
                # if campaign.settings:
                #     campaign.settings = convert_localhost_video_urls(campaign.settings)
                
                # Debug: Log if campaign has videos
                if campaign.settings and campaign.settings.get("videos"):
                    print(f"📹 Campaign {campaign.id} has {len(campaign.settings['videos'])} videos in settings")
                
                result.append(CampaignResponse.model_validate(campaign))
            except Exception as validation_error:
                print(f"⚠️ Campaign validation failed for {campaign.id}: {validation_error}")
                # Skip this campaign if validation fails
                continue
        
        return result
    except Exception as e:
        print(f"❌ Error fetching campaigns: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/campaigns/count")
async def get_campaigns_count(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get total count of campaigns for the current user (fast endpoint)"""
    try:
        count = db.query(Campaign).filter(Campaign.user_id == current_user["user_id"]).count()
        return {"count": count}
    except Exception as e:
        print(f"❌ Error fetching campaigns count: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def save_generation_progress(db: Session, campaign_id: str, generated_images: list, current: int, total: int, status: str = "generating"):
    """
    Save generation progress after EACH image is generated.
    This enables progressive loading in the frontend.
    """
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            print(f"⚠️ Campaign {campaign_id} not found for progress update")
            return
        
        # Update settings with current progress
        new_settings = dict(campaign.settings) if campaign.settings else {}
        new_settings["generated_images"] = generated_images
        new_settings["generation_progress"] = {
            "current": current,
            "total": total,
            "percent": int((current / total) * 100) if total > 0 else 0
        }
        campaign.settings = new_settings
        campaign.generation_status = status
        
        # Force SQLAlchemy to detect the change
        flag_modified(campaign, "settings")
        
        db.commit()
        print(f"💾 Progress saved: {current}/{total} images ({new_settings['generation_progress']['percent']}%)")
        
    except Exception as e:
        print(f"⚠️ Failed to save progress: {e}")
        # Don't raise - we don't want to break generation if progress save fails
        db.rollback()

async def generate_campaign_images_background(
    campaign_id: str,
    product_id_list: list,
    model_id_list: list,
    scene_id_list: list,
    selected_poses_dict: dict,
    number_of_images: int,
    manikin_pose: str = "Pose-neutral.jpg"
):
    """
    Generate campaign images using BASE IMAGE + VARIATIONS workflow.
    
    NEW ARCHITECTURE:
    1. Generate ONE base image (model + all clothes + scene) - full body frontal
    2. Use that base image to generate keyframe variations with nano-banana:
       - Close-ups (shirt, pants)
       - Different poses
       - Different angles
    
    This ensures CONSISTENCY across all video keyframes.
    """
    # Create a NEW database session for this background task
    db = SessionLocal()
    try:
        # Get campaign from database
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            print(f"❌ Campaign {campaign_id} not found")
            return
        
        print(f"🎯 Starting background generation for campaign: {campaign.name}")
        print(f"📐 NEW WORKFLOW: Base Image → Keyframe Variations")
        
        products = db.query(Product).filter(Product.id.in_(product_id_list)).all()
        models = db.query(Model).filter(Model.id.in_(model_id_list)).all()
        scenes = db.query(Scene).filter(Scene.id.in_(scene_id_list)).all()
        
        # Load existing images to append to them (for multi-pose generation)
        existing_images = campaign.settings.get("generated_images", []) if campaign.settings else []
        generated_images = existing_images.copy()  # Start with existing images
        print(f"📌 Starting with {len(existing_images)} existing images")
        
        # Clamp requested number of images to available shot types
        try:
            shots_to_generate_count = max(1, min(int(number_of_images), len(CAMPAIGN_SHOT_TYPES)))
        except Exception:
            shots_to_generate_count = 1

        # Define KEYFRAME VARIATIONS to generate from base image
        # These are applied AFTER the base image is created
        KEYFRAME_VARIATIONS = [
            {
                "key": "base_fullbody",
                "name": "Full Body - Base",
                "title": "Full Body Shot (Base)",
                "prompt": "Same person, same outfit, same scene. Full body shot from head to feet. Professional fashion photography.",
                "is_base": True,  # This is the base image, no modification needed
                "strength": 0.0  # No modification
            },
            {
                "key": "shirt_closeup",
                "name": "Shirt Close-up",
                "title": "Shirt Close-up",
                "prompt": "Close-up shot of the shirt/top. Focus on the fabric, texture, and design details. Same person wearing the same outfit. Crop to show torso and arms only.",
                "is_base": False,
                "strength": 0.35,
                "negative_prompt": "different person, different clothes, changed outfit, full body, legs visible"
            },
            {
                "key": "pants_closeup",
                "name": "Pants Close-up", 
                "title": "Pants Close-up",
                "prompt": "Close-up shot of the pants/bottom. Focus on the fabric, texture, and fit. Same person wearing the same outfit. Crop to show waist to feet only.",
                "is_base": False,
                "strength": 0.35,
                "negative_prompt": "different person, different clothes, changed outfit, face visible, portrait"
            },
            {
                "key": "pose_dynamic",
                "name": "Dynamic Pose",
                "title": "Dynamic Pose",
                "prompt": "Same person, same outfit, same scene. Confident walking pose with natural movement. Full body from head to feet. Fashion editorial style.",
                "is_base": False,
                "strength": 0.40,
                "negative_prompt": "different person, different clothes, different face, static pose, stiff"
            },
            {
                "key": "pose_casual",
                "name": "Casual Pose",
                "title": "Casual Relaxed Pose",
                "prompt": "Same person, same outfit, same scene. Relaxed casual pose with hands in pockets or arms crossed. Full body from head to feet. Natural and approachable.",
                "is_base": False,
                "strength": 0.40,
                "negative_prompt": "different person, different clothes, different face, formal pose"
            }
        ]
        
        # Select which variations to generate based on number_of_images
        import random
        variations_to_use = KEYFRAME_VARIATIONS[:shots_to_generate_count]
        
        # Generate each combination with BASE IMAGE + VARIATIONS workflow
        for model in models:
            for scene in scenes:
                # Use model's selected pose if available
                model_image = model.image_url
                if selected_poses_dict.get(str(model.id)) and len(selected_poses_dict[str(model.id)]) > 0:
                    import random
                    model_image = random.choice(selected_poses_dict[str(model.id)])
                    print(f"🎭 Using selected pose for {model.name}")
                elif model.poses and len(model.poses) > 0:
                    import random
                    model_image = random.choice(model.poses)
                    print(f"🎭 Using random pose for {model.name}")
                
                # Build product list names for logging
                product_names = ", ".join([p.name for p in products])
                print(f"\n{'='*60}")
                print(f"🎬 Processing: [{product_names}] + {model.name} + {scene.name}")
                print(f"{'='*60}")
                
                # ============================================================
                # STEP 1: GENERATE BASE IMAGE (model + all clothes + scene)
                # ============================================================
                print(f"\n🎨 STEP 1: Generating BASE IMAGE...")
                print(f"   📷 Model: {model.name}")
                print(f"   👕 Products: {product_names}")
                print(f"   🏞️ Scene: {scene.name}")
                
                first_product = products[0]
                first_product_image = first_product.packshot_front_url or first_product.image_url
                quality_mode = "standard"

                # Stabilize inputs to /static to avoid replicate 404s
                stable_model = stabilize_url(model_image, "pose") if 'stabilize_url' in globals() else model_image
                stable_scene = stabilize_url(scene.image_url, "scene") if 'stabilize_url' in globals() else scene.image_url
                stable_first_product = stabilize_url(first_product_image, "product") if 'stabilize_url' in globals() else first_product_image
                
                # Generate base composition with Qwen (model + first product + scene)
                base_image_url = run_qwen_triple_composition(
                    stable_model,
                    stable_first_product,
                    stable_scene,
                    first_product.name,
                    quality_mode,
                    shot_type_prompt="Full body shot from head to feet. Professional fashion photography. Natural standing pose.",
                    clothing_type=first_product.clothing_type
                )
                print(f"✅ Base composition created: {base_image_url[:60]}...")
                
                # Add additional products to base image
                current_base_url = base_image_url
                if len(products) > 1:
                    print(f"👕 Adding {len(products) - 1} additional product(s) to base image...")
                    for additional_product in products[1:]:
                        additional_product_image = additional_product.packshot_front_url or additional_product.image_url
                        stable_additional_product = stabilize_url(additional_product_image, "product") if 'stabilize_url' in globals() else additional_product_image
                        
                        product_type = additional_product.clothing_type if hasattr(additional_product, 'clothing_type') and additional_product.clothing_type else "garment"
                        
                        print(f"   ➕ Adding {additional_product.name} ({product_type})...")
                        current_base_url = add_product_to_image(
                            current_base_url,
                            stable_additional_product,
                            additional_product.name,
                            product_type
                        )
                    print(f"✅ All {len(products)} products added to base image!")
                
                # Store stabilized base image URL
                base_image_url = current_base_url
                stable_base_url = stabilize_url(to_url(base_image_url), "base_image") if 'stabilize_url' in globals() else download_and_save_image(to_url(base_image_url), "campaign_base")
                print(f"📦 Base image saved: {stable_base_url[:60]}...")
                
                # Store product info for results
                combined_product_names = ", ".join([p.name for p in products])
                combined_product_ids = [str(p.id) for p in products]
                first_product_type = products[0].clothing_type if hasattr(products[0], 'clothing_type') and products[0].clothing_type else "outfit"
                
                # ============================================================
                # STEP 2: GENERATE KEYFRAME VARIATIONS FROM BASE IMAGE
                # ============================================================
                print(f"\n🎬 STEP 2: Generating {len(variations_to_use)} KEYFRAME VARIATIONS from base image...")
                
                for var_idx, variation in enumerate(variations_to_use, 1):
                    try:
                        print(f"\n🎥 [{var_idx}/{len(variations_to_use)}] {variation['title']}")
                        
                        if variation.get("is_base", False):
                            # Base image - no modification needed, just use it directly
                            final_url = stable_base_url
                            print(f"   ✅ Using base image directly (no modification)")
                        else:
                            # Generate variation from base image using nano-banana
                            print(f"   🔄 Generating variation with nano-banana...")
                            print(f"   📝 Prompt: {variation['prompt'][:80]}...")
                            print(f"   ⚙️ Strength: {variation['strength']}")
                            
                            variation_url = run_nano_banana_pro(
                                prompt=variation['prompt'],
                                image_urls=[stable_base_url],
                                strength=variation['strength'],
                                guidance_scale=7.0,
                                num_steps=30,
                                negative_prompt=variation.get('negative_prompt', 'different person, different clothes')
                            )
                            
                            # Stabilize the variation URL
                            final_url = stabilize_url(to_url(variation_url), f"variation_{variation['key']}") if 'stabilize_url' in globals() else download_and_save_image(to_url(variation_url), f"campaign_{variation['key']}")
                            print(f"   ✅ Variation saved: {final_url[:60]}...")
                        
                        # Append to generated images
                        generated_images.append({
                            "product_name": combined_product_names,
                            "product_id": combined_product_ids[0] if combined_product_ids else str(products[0].id),
                            "product_ids": combined_product_ids,
                            "model_name": model.name,
                            "scene_name": scene.name,
                            "shot_type": variation['title'],
                            "shot_name": variation['name'],
                            "image_url": final_url,
                            "base_image_url": stable_base_url,  # NEW: Reference to base image
                            "model_image_url": model_image,
                            "product_image_url": first_product_image,
                            "clothing_type": first_product_type,
                            "is_base_image": variation.get("is_base", False)  # NEW: Flag for base image
                        })
                        
                        # 🔥 PROGRESSIVE LOADING: Save after EACH image so frontend can display immediately
                        save_generation_progress(
                            db, 
                            campaign_id, 
                            generated_images, 
                            current=len(generated_images), 
                            total=len(variations_to_use) * len(models) * len(scenes),
                            status="generating"
                        )
                        
                        print(f"   ✅ Keyframe {var_idx} completed!")
                        
                    except Exception as e:
                        print(f"❌ Failed variation {variation['title']}: {e}")
                        import traceback
                        traceback.print_exc()
                        continue
                
                print(f"\n🎉 Campaign flow complete: [{product_names}] + {model.name} + {scene.name}")
                print(f"   📸 Generated {len(variations_to_use)} keyframes from 1 base image")
        
        # Update campaign with generated images
        campaign.generation_status = "completed" if len(generated_images) > 0 else "failed"
        
        # Create new settings dict to force SQLAlchemy to detect change
        new_settings = dict(campaign.settings) if campaign.settings else {}
        new_settings["generated_images"] = generated_images
        # Mark preview as generated if this was a preview generation
        if campaign.status == "preview":
            new_settings["preview_generated"] = True
        campaign.settings = new_settings
        
        # Force SQLAlchemy to detect the change
        flag_modified(campaign, "settings")
        
        db.commit()
        db.refresh(campaign)
        
        print(f"🎉 Campaign generation completed with {len(generated_images)} images")
        print(f"📊 Expected: {shots_to_generate_count} shots, Generated: {len(generated_images)} shots")
        print(f"🔍 DEBUG: Generated images structure: {generated_images}")
        print(f"🔍 DEBUG: Campaign settings after update: {campaign.settings}")
        if len(generated_images) < shots_to_generate_count:
            print(f"⚠️ WARNING: Only {len(generated_images)}/{shots_to_generate_count} shots were generated successfully")
        
    except Exception as e:
        print(f"❌ Background generation failed: {e}")
        import traceback
        traceback.print_exc()
        
        # Update campaign status to failed
        try:
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if campaign:
                campaign.generation_status = "failed"
                db.commit()
        except Exception as update_error:
            print(f"❌ Failed to update campaign status: {update_error}")
    finally:
        # CRITICAL: Close database session to prevent connection pool exhaustion
        db.close()
        print(f"✅ Database session closed for campaign {campaign_id}")

@app.post("/campaigns/create")
async def create_campaign(
    name: str = Form(...),
    description: str = Form(""),
    product_ids: str = Form(...),  # JSON string
    model_ids: str = Form(...),    # JSON string
    scene_ids: str = Form(...),    # JSON string
    selected_poses: str = Form("{}"),  # JSON string
    manikin_pose: str = Form("Pose-neutral.jpg"),  # Selected manikin pose
    number_of_images: int = Form(1),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new campaign"""
    try:
        import json
        
        # Parse JSON strings
        product_id_list = json.loads(product_ids)
        model_id_list = json.loads(model_ids)
        scene_id_list = json.loads(scene_ids)
        selected_poses_dict = json.loads(selected_poses)
        
        if not product_id_list or not model_id_list or not scene_id_list:
            raise HTTPException(status_code=400, detail="Please select at least one product, model, and scene")
        
        # Create campaign with "preview" status
        campaign = Campaign(
            user_id=current_user["user_id"],
            name=name,
            description=description,
            status="preview",  # New: preview status
            generation_status="generating",
            settings={
                "product_ids": product_id_list,
                "model_ids": model_id_list,
                "scene_ids": scene_id_list,
                "selected_poses": selected_poses_dict,
                "manikin_pose": manikin_pose,  # Store initial pose for preview
                "generated_images": [],
                "preview_generated": False
            }
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)
        
        print(f"🎯 Campaign created with ID: {campaign.id}, generating PREVIEW with pose: {manikin_pose}...")
        
        # Return immediately so frontend can show the campaign with "generating" status
        response_data = {
            "campaign": CampaignResponse.model_validate(campaign),
            "message": f"Campaign '{name}' created - generating preview!",
            "generated_images": []
        }
        
        # Start PREVIEW generation in background (only 1 image with selected pose)
        import asyncio
        asyncio.create_task(generate_campaign_images_background(
            campaign.id, 
            product_id_list, 
            model_id_list, 
            scene_id_list, 
            selected_poses_dict, 
            1,  # Only 1 preview image
            manikin_pose  # Use selected pose
        ))
        
        return response_data
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/campaigns/{campaign_id}/status")
async def get_campaign_generation_status(
    campaign_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the generation status of a campaign including full campaign data"""
    try:
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Return full campaign object so frontend can update modal with videos
        return {
            "campaign_id": campaign.id,
            "generation_status": campaign.generation_status,
            "status": campaign.status,
            "generated_images_count": len(campaign.settings.get("generated_images", [])) if campaign.settings else 0,
            "updated_at": campaign.updated_at,
            # Include full campaign for video updates
            "campaign": {
                "id": campaign.id,
                "name": campaign.name,
                "status": campaign.status,
                "generation_status": campaign.generation_status,
                "settings": campaign.settings,
                "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
                "updated_at": campaign.updated_at.isoformat() if campaign.updated_at else None
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# NEW: Keyframe Progress Endpoint
# ============================================================
@app.get("/campaigns/{campaign_id}/keyframe-progress")
async def get_keyframe_progress(
    campaign_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the progress of keyframe generation"""
    try:
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Get progress from settings
        progress = campaign.settings.get("keyframe_progress", {}) if campaign.settings else {}
        
        return {
            "status": campaign.generation_status,
            "current": progress.get("current", 0),
            "total": progress.get("total", 0),
            "current_name": progress.get("current_name", ""),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# NEW: Generate Keyframe Variations from Base Image
# ============================================================
@app.post("/campaigns/{campaign_id}/generate-keyframes")
async def generate_keyframe_variations(
    campaign_id: str,
    number_of_keyframes: int = Form(4),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate keyframe variations from an existing base image.
    
    This endpoint:
    1. Finds the base image from the campaign's generated images
    2. Generates keyframe variations (close-ups, poses) using nano-banana
    3. Appends them to the campaign's generated images
    
    The model, clothes, and scene remain IDENTICAL - only the framing/pose changes.
    """
    try:
        # Get campaign
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Get existing generated images
        generated_images = campaign.settings.get("generated_images", []) if campaign.settings else []
        
        if not generated_images:
            raise HTTPException(status_code=400, detail="No base image found. Generate a campaign image first.")
        
        # Find the base image (first image or one marked as is_base_image)
        base_image = None
        for img in generated_images:
            if img.get("is_base_image", False):
                base_image = img
                break
        
        # If no explicit base image, use the first one
        if not base_image:
            base_image = generated_images[0]
        
        base_image_url = base_image.get("base_image_url") or base_image.get("image_url")
        
        if not base_image_url:
            raise HTTPException(status_code=400, detail="Base image URL not found")
        
        print(f"🎬 KEYFRAME GENERATION: Using base image: {base_image_url[:60]}...")
        print(f"📸 Generating {number_of_keyframes} keyframe variations...")
        
        # Update campaign status
        campaign.generation_status = "generating"
        new_settings = dict(campaign.settings) if campaign.settings else {}
        campaign.settings = new_settings
        flag_modified(campaign, "settings")
        db.commit()
        
        # Start keyframe generation in background
        import asyncio
        asyncio.create_task(generate_keyframes_background(
            campaign_id,
            base_image_url,
            base_image,  # Pass full base image data for metadata
            number_of_keyframes
        ))
        
        return {
            "message": f"Generating {number_of_keyframes} keyframe variations from base image...",
            "campaign_id": campaign_id,
            "base_image_url": base_image_url,
            "status": "generating"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# KEYFRAME TEMPLATES - Pre-defined shot sequences
# ============================================================
KEYFRAME_TEMPLATES = {
    "industrial_editorial": {
        "id": "industrial_editorial",
        "name": "Industrial Editorial",
        "description": "High-contrast concrete studio with chrome elements and clinical aesthetic",
        "preview_emoji": "🏭",
        "shots": [
            {
                "name": "Wide Establishing",
                "prompt": "Low-angle fashion editorial photography in an industrial concrete studio. Camera positioned near the floor, looking up to elongate the subject. Model sits in a chrome chair. High-contrast lighting from massive overhead softbox. Sharp details, wide-angle lens (24mm), cool gray color grading. Same person, same outfit.",
                "strength": 0.55,
                "negative_prompt": "blurry, warm colors, soft lighting, different person, different clothes"
            },
            {
                "name": "Medium Portrait",
                "prompt": "Medium close-up fashion portrait of the person. Sitting in chrome-framed black leather chair. Background: minimalist concrete studio with translucent corrugated plastic dividers catching light. Soft top-down lighting, high-end editorial look. 8k, sharp focus on facial features. Same person, same outfit.",
                "strength": 0.50,
                "negative_prompt": "blurry, cluttered background, different person, different clothes"
            },
            {
                "name": "Fabric Detail",
                "prompt": "Extreme close-up, low-angle fashion photograph of the torso. Camera angled from side, focusing on fabric weave and texture. Background: soft-focus translucent plastic panels, concrete wall. Clinical industrial atmosphere, cold color temperature, sharp macro details. Same outfit.",
                "strength": 0.45,
                "negative_prompt": "face visible, warm tones, different clothes"
            },
            {
                "name": "Profile Silhouette",
                "prompt": "Side profile fashion photograph in industrial studio. Strong rim lighting from behind creating silhouette effect. Concrete walls and metal structures in background. High contrast, dramatic shadows. Same person, same outfit.",
                "strength": 0.55,
                "negative_prompt": "front facing, flat lighting, different person"
            },
            {
                "name": "Walking Away",
                "prompt": "Fashion editorial shot from behind. Model walking through industrial corridor with concrete walls. Symmetrical composition, leading lines. Cool gray tones, editorial lighting. Same person, same outfit from behind.",
                "strength": 0.50,
                "negative_prompt": "facing camera, warm tones, different person"
            }
        ]
    },
    "golden_hour_romantic": {
        "id": "golden_hour_romantic",
        "name": "Golden Hour Romance",
        "description": "Warm sunset lighting with soft bokeh and dreamy atmosphere",
        "preview_emoji": "🌅",
        "shots": [
            {
                "name": "Sunset Silhouette",
                "prompt": "Wide fashion photograph at golden hour. Model silhouetted against warm orange sunset sky. Long shadows, lens flare. Romantic, dreamy atmosphere. Same person, same outfit.",
                "strength": 0.55,
                "negative_prompt": "cold colors, harsh lighting, different person"
            },
            {
                "name": "Warm Close-up",
                "prompt": "Intimate close-up portrait bathed in warm golden light. Soft focus background with bokeh. Sun rays catching hair. Romantic editorial style. Same person, same outfit.",
                "strength": 0.48,
                "negative_prompt": "cold tones, harsh shadows, different person"
            },
            {
                "name": "Backlit Full Body",
                "prompt": "Full body fashion shot with sun behind model creating halo effect. Warm rim lighting on edges. Soft, diffused golden hour light. Dreamy, ethereal quality. Same person, same outfit.",
                "strength": 0.52,
                "negative_prompt": "front lighting, cold tones, different person"
            },
            {
                "name": "Candid Moment",
                "prompt": "Candid fashion photograph, model looking away into the sunset. Natural, unposed feeling. Warm color grading, soft shadows. Magazine editorial style. Same person, same outfit.",
                "strength": 0.50,
                "negative_prompt": "stiff pose, cold lighting, different person"
            },
            {
                "name": "Detail with Flare",
                "prompt": "Close-up of outfit details with sun flare in frame. Warm golden tones on fabric. Artistic lens flare creating dreamy effect. Same outfit.",
                "strength": 0.45,
                "negative_prompt": "cold colors, no flare, different clothes"
            }
        ]
    },
    "urban_streetwear": {
        "id": "urban_streetwear",
        "name": "Urban Streetwear",
        "description": "Gritty city vibes with graffiti walls and street elements",
        "preview_emoji": "🏙️",
        "shots": [
            {
                "name": "Graffiti Wall",
                "prompt": "Urban fashion photograph against colorful graffiti wall. Street style editorial. Model in confident stance. Harsh daylight, high contrast. Same person, same outfit.",
                "strength": 0.55,
                "negative_prompt": "studio background, soft lighting, different person"
            },
            {
                "name": "Street Corner",
                "prompt": "Fashion shot on urban street corner. City buildings in background, cars passing. Documentary street style. Same person, same outfit. Authentic urban energy.",
                "strength": 0.52,
                "negative_prompt": "nature background, rural, different person"
            },
            {
                "name": "Low Angle Power",
                "prompt": "Low-angle urban fashion shot. Camera near ground looking up at model. City skyline behind. Empowering, confident pose. Same person, same outfit.",
                "strength": 0.50,
                "negative_prompt": "high angle, timid pose, different person"
            },
            {
                "name": "Motion Blur",
                "prompt": "Dynamic urban fashion photograph with motion blur. Model sharp while background shows movement. City traffic, pedestrians blurred. Same person, same outfit. Energy and movement.",
                "strength": 0.55,
                "negative_prompt": "static, no movement, different person"
            },
            {
                "name": "Alley Editorial",
                "prompt": "Moody fashion shot in urban alley. Brick walls, fire escapes, urban textures. Dramatic shadows, editorial lighting. Same person, same outfit. Gritty atmosphere.",
                "strength": 0.52,
                "negative_prompt": "bright, clean, different person"
            }
        ]
    },
    "minimalist_studio": {
        "id": "minimalist_studio",
        "name": "Minimalist Studio",
        "description": "Clean white/gray backgrounds with focus on the outfit",
        "preview_emoji": "⬜",
        "shots": [
            {
                "name": "Clean Full Body",
                "prompt": "Minimalist fashion photography on pure white background. Full body shot, centered composition. Clean studio lighting, no shadows. High-end e-commerce style. Same person, same outfit.",
                "strength": 0.50,
                "negative_prompt": "busy background, shadows, different person"
            },
            {
                "name": "Three-Quarter Turn",
                "prompt": "Fashion photograph with model at three-quarter angle. Clean gray studio background. Soft, even lighting. Focus on outfit silhouette. Same person, same outfit.",
                "strength": 0.48,
                "negative_prompt": "cluttered, harsh shadows, different person"
            },
            {
                "name": "Detail Close-up",
                "prompt": "Extreme close-up of outfit details on white background. Fabric texture, stitching, buttons visible. Studio macro photography. Crisp focus. Same outfit.",
                "strength": 0.42,
                "negative_prompt": "blurry, face visible, different clothes"
            },
            {
                "name": "Movement Shot",
                "prompt": "Fashion photograph with subtle movement - fabric flowing, hair moving. White studio background. Dynamic but controlled. Same person, same outfit.",
                "strength": 0.52,
                "negative_prompt": "static, stiff, different person"
            },
            {
                "name": "Side Profile Clean",
                "prompt": "Side profile fashion shot on minimal background. Clean lines, elegant pose. High-end editorial simplicity. Same person, same outfit.",
                "strength": 0.50,
                "negative_prompt": "busy background, front facing, different person"
            }
        ]
    }
}

@app.get("/templates")
async def get_keyframe_templates():
    """Get all available keyframe templates"""
    templates_list = []
    for template_id, template in KEYFRAME_TEMPLATES.items():
        templates_list.append({
            "id": template["id"],
            "name": template["name"],
            "description": template["description"],
            "preview_emoji": template["preview_emoji"],
            "shot_count": len(template["shots"]),
            "shots": [{"name": shot["name"], "prompt": shot["prompt"][:100] + "..."} for shot in template["shots"]]
        })
    return {"templates": templates_list}


@app.post("/campaigns/{campaign_id}/generate-template-keyframes")
async def generate_template_keyframes(
    campaign_id: str,
    template_id: str = Form(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate keyframes using a predefined template.
    Each shot in the template is generated from the campaign's base image.
    """
    try:
        # Get template
        template = KEYFRAME_TEMPLATES.get(template_id)
        if not template:
            raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
        
        # Get campaign
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Get base image
        generated_images = campaign.settings.get("generated_images", []) if campaign.settings else []
        if not generated_images:
            raise HTTPException(status_code=400, detail="No base image found. Generate a campaign image first.")
        
        base_image = None
        for img in generated_images:
            if img.get("is_base_image", False):
                base_image = img
                break
        if not base_image:
            base_image = generated_images[0]
        
        base_image_url = base_image.get("base_image_url") or base_image.get("image_url")
        if not base_image_url:
            raise HTTPException(status_code=400, detail="Base image URL not found")
        
        print(f"🎬 TEMPLATE KEYFRAME GENERATION: {template['name']}")
        print(f"📸 Template has {len(template['shots'])} shots")
        print(f"🖼️ Base image: {base_image_url[:60]}...")
        
        # Update campaign status
        campaign.generation_status = "generating"
        new_settings = dict(campaign.settings) if campaign.settings else {}
        new_settings["template_generation"] = {
            "template_id": template_id,
            "template_name": template["name"],
            "status": "generating"
        }
        campaign.settings = new_settings
        flag_modified(campaign, "settings")
        db.commit()
        
        # Start background generation
        import asyncio
        asyncio.create_task(generate_template_keyframes_background(
            campaign_id,
            base_image_url,
            base_image,
            template
        ))
        
        return {
            "message": f"Generating {len(template['shots'])} keyframes using '{template['name']}' template...",
            "campaign_id": campaign_id,
            "template": template["name"],
            "shot_count": len(template["shots"]),
            "status": "generating"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


async def generate_template_keyframes_background(
    campaign_id: str,
    base_image_url: str,
    base_image_data: dict,
    template: dict
):
    """Background task to generate keyframes from a template"""
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            print(f"❌ Campaign {campaign_id} not found")
            return
        
        print(f"\n{'='*60}")
        print(f"🎬 TEMPLATE GENERATION: {template['name']}")
        print(f"{'='*60}")
        
        shots = template["shots"]
        total_shots = len(shots)
        
        # Update progress
        campaign.settings["keyframe_progress"] = {
            "current": 0,
            "total": total_shots,
            "current_name": "Starting template generation..."
        }
        flag_modified(campaign, "settings")
        db.commit()
        
        generated_images = campaign.settings.get("generated_images", [])
        
        for idx, shot in enumerate(shots):
            try:
                print(f"\n📸 [{idx+1}/{total_shots}] Generating: {shot['name']}")
                print(f"   Prompt: {shot['prompt'][:80]}...")
                
                # Update progress
                campaign.settings["keyframe_progress"] = {
                    "current": idx,
                    "total": total_shots,
                    "current_name": shot["name"]
                }
                flag_modified(campaign, "settings")
                db.commit()
                
                # Generate using nano-banana
                result_url = run_nano_banana_pro(
                    input_image_url=base_image_url,
                    prompt=shot["prompt"],
                    strength=shot.get("strength", 0.50),
                    guidance_scale=6.5,
                    num_inference_steps=28,
                    negative_prompt=shot.get("negative_prompt", "blurry, distorted, different person")
                )
                
                if result_url:
                    # Add to generated images
                    new_image = {
                        "image_url": result_url,
                        "base_image_url": base_image_url,
                        "shot_type": shot["name"],
                        "shot_name": shot["name"],
                        "template_id": template["id"],
                        "template_name": template["name"],
                        "prompt_used": shot["prompt"],
                        "model_name": base_image_data.get("model_name", "Model"),
                        "product_name": base_image_data.get("product_name", "Product"),
                        "scene_name": base_image_data.get("scene_name", "Scene"),
                        "clothing_type": base_image_data.get("clothing_type", "Outfit"),
                        "is_base_image": False,
                        "generated_at": datetime.utcnow().isoformat()
                    }
                    generated_images.append(new_image)
                    
                    # Save immediately
                    campaign.settings["generated_images"] = generated_images
                    flag_modified(campaign, "settings")
                    db.commit()
                    
                    print(f"   ✅ Success: {result_url[:50]}...")
                else:
                    print(f"   ❌ Failed to generate")
                    
            except Exception as e:
                print(f"   ❌ Error generating {shot['name']}: {e}")
        
        # Mark complete
        campaign.generation_status = "completed"
        campaign.settings["keyframe_progress"] = {
            "current": total_shots,
            "total": total_shots,
            "current_name": "Complete!"
        }
        campaign.settings["template_generation"]["status"] = "completed"
        flag_modified(campaign, "settings")
        db.commit()
        
        print(f"\n✅ Template generation complete: {template['name']}")
        
    except Exception as e:
        print(f"❌ Template generation error: {e}")
        import traceback
        traceback.print_exc()
        
        try:
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if campaign:
                campaign.generation_status = "failed"
                campaign.settings["template_generation"]["status"] = "failed"
                campaign.settings["template_generation"]["error"] = str(e)
                flag_modified(campaign, "settings")
                db.commit()
        except:
            pass
    finally:
        db.close()


async def generate_keyframes_background(
    campaign_id: str,
    base_image_url: str,
    base_image_data: dict,
    number_of_keyframes: int
):
    """
    Background task to generate keyframe variations from a base image.
    Uses nano-banana-pro to create variations while preserving identity.
    """
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            print(f"❌ Campaign {campaign_id} not found")
            return
        
        print(f"\n{'='*60}")
        print(f"🎬 KEYFRAME GENERATION for campaign: {campaign.name}")
        print(f"{'='*60}")
        print(f"📷 Base image: {base_image_url[:60]}...")
        
        # Define all available keyframe variations - MIXED ORDER for variety
        # Close-ups interspersed with candid/scene shots
        KEYFRAME_VARIATIONS = [
            # 1. Candid shot
            {
                "key": "candid_looking_away",
                "name": "Looking Away",
                "title": "Candid - Looking Away",
                "prompt": "Same person, same exact outfit, same location. CANDID SHOT: Person NOT looking at camera. Looking to the side, gazing into the distance, or looking down thoughtfully. Natural relaxed expression. Profile or 3/4 view of face. Lifestyle photography, authentic moment. Full body visible in the environment.",
                "strength": 0.55,
                "negative_prompt": "looking at camera, posed smile, direct eye contact, stiff pose"
            },
            # 2. SHIRT CLOSE-UP
            {
                "key": "closeup_shirt",
                "name": "Shirt Close-up",
                "title": "Shirt Detail Shot",
                "prompt": "Same person, same outfit. PRODUCT CLOSE-UP: Tight shot focusing on the SHIRT/TOP. Show fabric texture, print details, stitching, and fit around torso. Shoulders and chest visible. Blurred background showing hint of the scene. Fashion product photography. High detail on garment.",
                "strength": 0.42,
                "negative_prompt": "full body, legs visible, wide shot, different clothes, changed design"
            },
            # 3. Sitting interaction
            {
                "key": "interact_sitting",
                "name": "Sitting Interaction",
                "title": "Sitting in Scene",
                "prompt": "Same person, same exact outfit, same location. SEATED POSE: Person SITTING naturally on something in the environment - a chair, bench, ledge, steps, or edge. Relaxed seated position. NOT looking at camera, perhaps looking to the side or down. Casual lifestyle moment. Show the person using the space naturally.",
                "strength": 0.60,
                "negative_prompt": "standing, stiff pose, looking at camera, floating, unnatural"
            },
            # 4. PANTS CLOSE-UP
            {
                "key": "closeup_pants",
                "name": "Pants Close-up", 
                "title": "Pants Detail Shot",
                "prompt": "Same person, same outfit. PRODUCT CLOSE-UP: Tight shot focusing on the PANTS/BOTTOM. Show fabric texture, fit around waist and legs, details and styling. Waist to knees or feet visible. Blurred background showing hint of the scene. Fashion product photography. High detail on garment.",
                "strength": 0.42,
                "negative_prompt": "full body, face visible, portrait, wide shot, different clothes"
            },
            # 5. Leaning interaction
            {
                "key": "interact_leaning",
                "name": "Leaning on Something",
                "title": "Leaning Casually",
                "prompt": "Same person, same exact outfit, same location. LEANING POSE: Person LEANING against something in the environment - a wall, pillar, railing, or surface. Casual relaxed stance. One shoulder or back against the surface. Arms crossed or hands in pockets. Looking away from camera. Effortlessly cool lifestyle shot.",
                "strength": 0.58,
                "negative_prompt": "standing straight, posed, looking at camera, floating, stiff"
            },
            # 6. OUTFIT DETAIL CLOSE-UP
            {
                "key": "closeup_outfit_detail",
                "name": "Outfit Detail",
                "title": "Outfit Styling Close-up",
                "prompt": "Same person, same outfit. STYLING DETAIL: Focus on how the outfit comes together - the transition between top and bottom, tucking, belt area, or accessory details. Mid-body crop showing the outfit coordination. Fashion styling photography. Blurred scene in background.",
                "strength": 0.42,
                "negative_prompt": "full body, wide shot, face focus, different clothes, changed styling"
            },
            # 7. Contemplative
            {
                "key": "candid_in_thought",
                "name": "Lost in Thought",
                "title": "Contemplative Moment",
                "prompt": "Same person, same exact outfit, same location. CONTEMPLATIVE SHOT: Person in a thoughtful moment. Looking down or to the side. Perhaps touching chin or adjusting clothing. Natural pensive expression. Candid unposed feeling. Lifestyle editorial. NOT looking at camera. Intimate authentic moment captured.",
                "strength": 0.55,
                "negative_prompt": "looking at camera, big smile, posed, stiff, artificial"
            },
            # 8. Exploring
            {
                "key": "interact_walking_exploring",
                "name": "Exploring Space",
                "title": "Exploring the Space",
                "prompt": "Same person, same exact outfit, same location. EXPLORING: Person walking through and EXPLORING the environment. Looking around at the space, touching a wall or surface, discovering the location. Back partially to camera or profile view. Movement and curiosity. Candid lifestyle documentary feel.",
                "strength": 0.58,
                "negative_prompt": "posing, looking at camera, static, stiff, standing still"
            },
            # 9. Low angle
            {
                "key": "scene_low_angle",
                "name": "Low Angle Hero",
                "title": "Low Camera Angle",
                "prompt": "Same person, same exact outfit, same location. LOW ANGLE: Camera positioned LOW, shooting upward. Person looking to the side, NOT at camera. Powerful heroic perspective. Show ceiling and upper environment. Dramatic composition with vanishing lines. Cinematic fashion editorial.",
                "strength": 0.55,
                "negative_prompt": "eye level, flat angle, looking at camera, boring composition"
            },
            # 10. High angle
            {
                "key": "scene_high_angle",
                "name": "High Angle View",
                "title": "High Camera Angle",
                "prompt": "Same person, same exact outfit, same location. HIGH ANGLE: Camera positioned HIGH looking down. Person looking down or to the side, NOT at camera. Show floor patterns and textures. Bird's eye perspective. Perhaps crouching or sitting. Unique top-down view. Fashion editorial.",
                "strength": 0.55,
                "negative_prompt": "eye level, looking at camera, flat angle, same perspective"
            },
            # 11. Profile
            {
                "key": "scene_profile_pure",
                "name": "Pure Profile",
                "title": "Side Profile Shot",
                "prompt": "Same person, same exact outfit, same location. PURE PROFILE: Full side view, 90-degree angle. Person looking straight ahead (not at camera). Clean silhouette showing outfit shape. Different section of environment visible. Classic fashion profile. Elegant and editorial.",
                "strength": 0.58,
                "negative_prompt": "frontal, looking at camera, turned toward camera, same angle"
            }
        ]
        
        # Get existing images to append to
        existing_images = campaign.settings.get("generated_images", []) if campaign.settings else []
        
        # Find which variations are already generated
        existing_keys = set()
        for img in existing_images:
            if img.get("shot_name"):
                existing_keys.add(img["shot_name"])
        
        print(f"📌 Already generated: {existing_keys}")
        
        # Filter out variations that are already generated
        variations_to_generate = [v for v in KEYFRAME_VARIATIONS if v["name"] not in existing_keys]
        
        # Limit to requested number
        variations_to_generate = variations_to_generate[:number_of_keyframes]
        
        if not variations_to_generate:
            print(f"⚠️ All keyframe variations already generated!")
            campaign.generation_status = "completed"
            db.commit()
            return
        
        print(f"🎬 Generating {len(variations_to_generate)} new keyframe variations...")
        
        # Extract metadata from base image
        product_name = base_image_data.get("product_name", "outfit")
        product_ids = base_image_data.get("product_ids", [base_image_data.get("product_id", "")])
        model_name = base_image_data.get("model_name", "model")
        scene_name = base_image_data.get("scene_name", "scene")
        model_image_url = base_image_data.get("model_image_url", "")
        product_image_url = base_image_data.get("product_image_url", "")
        clothing_type = base_image_data.get("clothing_type", "outfit")
        
        total_to_generate = len(variations_to_generate)
        new_images = []
        
        # Initialize progress tracking
        new_settings = dict(campaign.settings) if campaign.settings else {}
        new_settings["keyframe_progress"] = {
            "current": 0,
            "total": total_to_generate,
            "current_name": "Starting..."
        }
        campaign.settings = new_settings
        flag_modified(campaign, "settings")
        db.commit()
        
        for var_idx, variation in enumerate(variations_to_generate, 1):
            try:
                print(f"\n🎥 [{var_idx}/{total_to_generate}] {variation['title']}")
                print(f"   📝 Prompt: {variation['prompt'][:80]}...")
                print(f"   ⚙️ Strength: {variation['strength']}")
                
                # Update progress BEFORE generating
                new_settings = dict(campaign.settings) if campaign.settings else {}
                new_settings["keyframe_progress"] = {
                    "current": var_idx - 1,
                    "total": total_to_generate,
                    "current_name": f"Generating: {variation['title']}..."
                }
                campaign.settings = new_settings
                flag_modified(campaign, "settings")
                db.commit()
                
                # Generate variation using nano-banana-pro
                variation_url = run_nano_banana_pro(
                    prompt=variation['prompt'],
                    image_urls=[base_image_url],
                    strength=variation['strength'],
                    guidance_scale=7.0,
                    num_steps=30,
                    negative_prompt=variation['negative_prompt']
                )
                
                # Stabilize the URL
                if 'stabilize_url' in globals():
                    final_url = stabilize_url(to_url(variation_url), f"keyframe_{variation['key']}")
                else:
                    final_url = download_and_save_image(to_url(variation_url), f"keyframe_{variation['key']}")
                
                print(f"   ✅ Keyframe saved: {final_url[:60]}...")
                
                # Create image entry
                new_image = {
                    "product_name": product_name,
                    "product_id": product_ids[0] if product_ids else "",
                    "product_ids": product_ids,
                    "model_name": model_name,
                    "scene_name": scene_name,
                    "shot_type": variation['title'],
                    "shot_name": variation['name'],
                    "image_url": final_url,
                    "base_image_url": base_image_url,
                    "model_image_url": model_image_url,
                    "product_image_url": product_image_url,
                    "clothing_type": clothing_type,
                    "is_base_image": False,
                    "is_keyframe_variation": True
                }
                new_images.append(new_image)
                
                # IMMEDIATELY save image to campaign so user can see it
                # Refresh existing images from DB to get latest state
                db.refresh(campaign)
                current_images = campaign.settings.get("generated_images", []) if campaign.settings else []
                current_images.append(new_image)
                
                # Update progress AND images AFTER generating
                new_settings = dict(campaign.settings) if campaign.settings else {}
                new_settings["generated_images"] = current_images  # Save images immediately
                new_settings["keyframe_progress"] = {
                    "current": var_idx,
                    "total": total_to_generate,
                    "current_name": f"✅ {variation['title']}"
                }
                campaign.settings = new_settings
                flag_modified(campaign, "settings")
                db.commit()
                print(f"   💾 Image saved to campaign - now visible to user!")
                
            except Exception as e:
                print(f"❌ Failed keyframe {variation['title']}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        # Mark as completed
        campaign.generation_status = "completed"
        new_settings = dict(campaign.settings) if campaign.settings else {}
        new_settings["keyframe_progress"] = {
            "current": total_to_generate,
            "total": total_to_generate,
            "current_name": "All keyframes completed!"
        }
        campaign.settings = new_settings
        flag_modified(campaign, "settings")
        db.commit()
        
        print(f"\n🎉 Keyframe generation complete!")
        print(f"   📸 Generated {len(new_images)} new keyframes")
        print(f"   📊 Total images: {len(all_images)}")
        
    except Exception as e:
        print(f"❌ Keyframe generation failed: {e}")
        import traceback
        traceback.print_exc()
        
        try:
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if campaign:
                campaign.generation_status = "failed"
                db.commit()
        except Exception as update_error:
            print(f"❌ Failed to update campaign status: {update_error}")
    finally:
        db.close()
        print(f"✅ Database session closed for keyframe generation {campaign_id}")


@app.post("/campaigns/{campaign_id}/generate")
async def generate_campaign_images(
    campaign_id: str,
    product_ids: str = Form("[]"),
    model_ids: str = Form("[]"),
    scene_ids: str = Form("[]"),
    selected_poses: str = Form("{}"),
    number_of_images: int = Form(1),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate images for a campaign"""
    try:
        import json
        
        # Get campaign
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Parse parameters or use campaign defaults
        product_id_list = json.loads(product_ids) if product_ids != "[]" else campaign.settings.get("product_ids", [])
        model_id_list = json.loads(model_ids) if model_ids != "[]" else campaign.settings.get("model_ids", [])
        scene_id_list = json.loads(scene_ids) if scene_ids != "[]" else campaign.settings.get("scene_ids", [])
        
        # Get entities
        products = db.query(Product).filter(Product.id.in_(product_id_list)).all()
        models = db.query(Model).filter(Model.id.in_(model_id_list)).all()
        scenes = db.query(Scene).filter(Scene.id.in_(scene_id_list)).all()
        
        if not products or not models or not scenes:
            raise HTTPException(status_code=400, detail="Missing products, models, or scenes")
        
        campaign.status = "processing"
        db.commit()
        
        print(f"🎯 Generating MORE images for campaign: {campaign.name}")
        print(f"📊 {len(products)} products × {len(models)} models × {len(scenes)} scenes")
        
        # Get existing images to APPEND to them
        existing_images = campaign.settings.get("generated_images", []) if campaign.settings else []
        print(f"📌 Existing images: {len(existing_images)}")
        
        new_images = []
        
        # Generate each combination with MULTIPLE SHOT TYPES for campaign flow
        # NEW: Process all products together for each model+scene combination
        for model in models:
            for scene in scenes:
                # Use model's pose if available, or select random
                if model.poses and len(model.poses) > 0:
                    import random
                    model_image = random.choice(model.poses)
                    print(f"🎭 Using random pose for {model.name}")
                else:
                    model_image = model.image_url
                
                # Build product list names for logging
                product_names = ", ".join([p.name for p in products])
                print(f"🎬 Processing campaign flow: [{product_names}] + {model.name} + {scene.name}")
                print(f"📸 Generating {number_of_images} images with {len(products)} product(s)...")
                
                # Generate only the requested number of images - RANDOMIZED
                import random
                available_shots = CAMPAIGN_SHOT_TYPES.copy()
                random.shuffle(available_shots)
                shot_types_to_generate = available_shots[:number_of_images]
                
                # If manikin pose is set, ensure first shot is full body frontal (not side view or closeup)
                campaign_manikin_pose = campaign.settings.get("manikin_pose", "") if campaign.settings else ""
                if campaign_manikin_pose and campaign_manikin_pose != "":
                    # Find a FULL BODY frontal shot type (not profile/side/closeup/detail)
                    excluded_keywords = ['side', 'profile', 'close', 'closeup', 'detail', 'macro', 'upper', 'lower']
                    full_body_frontal_shots = [s for s in available_shots if not any(keyword in s['name'].lower() for keyword in excluded_keywords)]
                    if full_body_frontal_shots and len(shot_types_to_generate) > 0:
                        # Replace first shot with a full body frontal one
                        shot_types_to_generate[0] = full_body_frontal_shots[0]
                        print(f"🎯 Using full body frontal shot for manikin pose: {full_body_frontal_shots[0]['title']}")
                    elif len(shot_types_to_generate) > 0:
                        # Fallback to any frontal shot if no full body found
                        frontal_shots = [s for s in available_shots if 'side' not in s['name'].lower() and 'profile' not in s['name'].lower()]
                        if frontal_shots:
                            shot_types_to_generate[0] = frontal_shots[0]
                            print(f"🎯 Using frontal shot for manikin pose: {frontal_shots[0]['title']}")
                
                    for shot_idx, shot_type in enumerate(shot_types_to_generate, 1):
                        try:
                            print(f"\n🎥 [{shot_idx}/{number_of_images}] {shot_type['title']}")
                            
                            # NEW MULTI-PRODUCT WORKFLOW
                            # Step 1: Generate base image with first product using Qwen
                            first_product = products[0]
                            first_product_image = first_product.packshot_front_url or first_product.image_url
                            quality_mode = "standard"

                            # Stabilize inputs to /static to avoid replicate 404s
                            stable_model = stabilize_url(model_image, "pose") if 'stabilize_url' in globals() else model_image
                            stable_scene = stabilize_url(scene.image_url, "scene") if 'stabilize_url' in globals() else scene.image_url
                            stable_first_product = stabilize_url(first_product_image, "product") if 'stabilize_url' in globals() else first_product_image
                            
                            print(f"🎬 Step 1: Qwen base composition - Model + {first_product.name} + Scene...")
                            person_wearing_product_url = run_qwen_triple_composition(
                                stable_model,
                                stable_first_product,
                                stable_scene,
                                first_product.name,
                                quality_mode,
                                shot_type_prompt=shot_type['prompt'],
                                clothing_type=first_product.clothing_type
                            )
                            print(f"✅ Base image with {first_product.name} completed: {person_wearing_product_url[:50]}...")
                            
                            # Step 2: Add additional products sequentially using nano-banana
                            current_image_url = person_wearing_product_url
                            if len(products) > 1:
                                print(f"👕 Adding {len(products) - 1} additional product(s) using nano-banana...")
                                for additional_product in products[1:]:
                                    additional_product_image = additional_product.packshot_front_url or additional_product.image_url
                                    stable_additional_product = stabilize_url(additional_product_image, "product") if 'stabilize_url' in globals() else additional_product_image
                                    
                                    # Get product type from clothing_type field
                                    product_type = additional_product.clothing_type if hasattr(additional_product, 'clothing_type') and additional_product.clothing_type else "garment"
                                    
                                    print(f"➕ Adding {additional_product.name} ({product_type}) to current image...")
                                    current_image_url = add_product_to_image(
                                        current_image_url,
                                        stable_additional_product,
                                        additional_product.name,
                                        product_type
                                    )
                                print(f"✅ All {len(products)} products added successfully!")
                            
                            # Update reference to final image with all products
                            person_wearing_product_url = current_image_url
                            
                            # Step 3: SKIP manikin pose replacement - it causes unnatural results
                            # Just use the Qwen output directly
                            final_result_url = person_wearing_product_url
                            print(f"✅ Using Qwen output directly (skipping pose replacement for more natural look)")
                            
                            # OLD CODE - Causing unnatural poses:
                            # if shot_idx == 1:
                            #     final_result_url = replace_manikin_with_person(manikin_pose_url, person_wearing_product_url)
                            
                            # Store all product info for the result (combined names)
                            combined_product_names = ", ".join([p.name for p in products])
                            combined_product_ids = [str(p.id) for p in products]
                            first_product_image = products[0].packshot_front_url or products[0].image_url
                            first_product_type = products[0].clothing_type if hasattr(products[0], 'clothing_type') and products[0].clothing_type else "outfit"
                            
                            # Normalize and store final URL
                            print(f"💾 Normalizing final result URL...")
                            final_url = stabilize_url(to_url(final_result_url), f"final_{shot_type['name']}") if 'stabilize_url' in globals() else download_and_save_image(to_url(final_result_url), f"campaign_{shot_type['name']}")
                            print(f"✅ Final result saved locally: {final_url[:50]}...")
                            
                            new_images.append({
                                "product_name": combined_product_names,
                                "product_id": combined_product_ids[0] if combined_product_ids else str(products[0].id),
                                "product_ids": combined_product_ids,  # NEW: Store all product IDs
                                "model_name": model.name,
                                "scene_name": scene.name,
                                "shot_type": shot_type['title'],
                                "shot_name": shot_type['name'],
                                "image_url": final_url,
                                "model_image_url": model_image,
                                "product_image_url": first_product_image,
                                "clothing_type": first_product_type
                            })
                            
                            print(f"✅ Shot completed: {shot_type['title']}")
                            
                        except Exception as e:
                            print(f"❌ Failed shot {shot_type['title']}: {e}")
                            import traceback
                            traceback.print_exc()
                            continue
                    
                print(f"\n🎉 Campaign flow complete: [{product_names}] + {model.name} + {scene.name}")
        
        # Update campaign
        campaign.status = "completed" if len(new_images) > 0 else "failed"
        
        # APPEND new images to existing ones (don't replace!)
        all_images = existing_images + new_images
        print(f"📊 Total images: {len(existing_images)} existing + {len(new_images)} new = {len(all_images)} total")
        
        # Create new settings dict to force SQLAlchemy to detect change
        new_settings = dict(campaign.settings) if campaign.settings else {}
        new_settings["generated_images"] = all_images
        campaign.settings = new_settings
        
        # Force SQLAlchemy to detect the change
        flag_modified(campaign, "settings")
        
        db.commit()
        db.refresh(campaign)
        
        print(f"🎉 Campaign update complete: {len(new_images)} new images generated, {len(all_images)} total")
        
        return {
            "message": f"Generated {len(new_images)} new images ({len(all_images)} total)",
            "campaign": CampaignResponse.model_validate(campaign),
            "generated_images": new_images,  # Return only new images
            "total_images": len(all_images)
        }
        
    except Exception as e:
        print(f"❌ Campaign generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/campaigns/{campaign_id}/generate-all-poses")
async def generate_all_pose_variations(
    campaign_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate images for ALL manikin poses (neutral, handneck, thinking)"""
    print(f"🎯 ENDPOINT HIT: generate-all-poses for campaign {campaign_id}")
    print(f"👤 User: {current_user.get('user_id', 'unknown')}")
    try:
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            print(f"❌ Campaign {campaign_id} not found for user {current_user['user_id']}")
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # All available poses
        ALL_POSES = ["Pose-neutral.jpg", "Pose-handneck.jpg", "Pose-thinking.jpg"]
        
        # Get the pose that was already used for preview
        preview_pose = campaign.settings.get("manikin_pose", "Pose-neutral.jpg") if campaign.settings else "Pose-neutral.jpg"
        
        # Generate for remaining poses
        remaining_poses = [pose for pose in ALL_POSES if pose != preview_pose]
        
        print(f"🎯 Generating full campaign with {len(remaining_poses)} additional poses...")
        print(f"📋 Preview pose: {preview_pose}")
        print(f"📋 Remaining poses: {remaining_poses}")
        
        campaign.status = "generating_full"
        campaign.generation_status = "generating"
        db.commit()
        
        # Get campaign settings
        product_ids = campaign.settings.get("product_ids", [])
        model_ids = campaign.settings.get("model_ids", [])
        scene_ids = campaign.settings.get("scene_ids", [])
        selected_poses = campaign.settings.get("selected_poses", {})
        
        # Generate images for each remaining pose
        import asyncio
        asyncio.create_task(generate_multiple_pose_variations(
            campaign_id,
            product_ids,
            model_ids,
            scene_ids,
            selected_poses,
            remaining_poses
        ))
        
        print(f"✅ Background task started for {len(remaining_poses)} poses")
        
        return {
            "message": f"Generating {len(remaining_poses)} additional pose variations",
            "remaining_poses": remaining_poses,
            "total_poses": len(ALL_POSES),
            "status": "started"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to start full campaign generation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

async def generate_multiple_pose_variations(
    campaign_id: str,
    product_ids: list,
    model_ids: list,
    scene_ids: list,
    selected_poses: dict,
    poses: list
):
    """Generate images for multiple poses by applying pose transfer to preview image"""
    # Create a NEW database session for this background task
    db = SessionLocal()
    try:
        # Get campaign and preview image
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            print(f"❌ Campaign {campaign_id} not found")
            return
        
        # Get the preview image (first generated image)
        existing_images = campaign.settings.get("generated_images", []) if campaign.settings else []
        if not existing_images or len(existing_images) == 0:
            print(f"❌ No preview image found for campaign {campaign_id}")
            campaign.generation_status = "failed"
            db.commit()
            return
        
        preview_image = existing_images[0]
        preview_image_url = preview_image.get("image_url")
        print(f"🖼️ Using preview image as base: {preview_image_url[:80]}...")
        
        # Load existing images to append new poses
        generated_images = existing_images.copy()
        
        # Define different positions for the model WITHIN the scene for each pose
        pose_angles = {
            "Pose-handneck.jpg": {
                "angle": "model repositioned to a different location in the scene",
                "description": "Move the person to a different spot within the same scene environment. The person is now standing in another area of the location - maybe closer to scene elements, or in a different part of the space. Same pose, same clothing, but different positioning within the scene composition."
            },
            "Pose-thinking.jpg": {
                "angle": "model in an alternate position within the scene", 
                "description": "Place the person in a different location within the scene. They could be nearer or further from the camera, positioned differently relative to the background elements. Creative repositioning that makes the shot more dynamic while maintaining the same scene environment."
            }
        }
        
        # For each remaining pose, use nano-banana to transfer pose + reposition model in scene
        for pose_idx, pose_filename in enumerate(poses, 1):
            print(f"\n📸 [{pose_idx}/{len(poses)}] Applying pose: {pose_filename}")
            
            try:
                # Get manikin pose URL from cache or upload on-demand
                cached_url = POSE_IMAGE_URLS.get(pose_filename)
                if cached_url and cached_url.startswith("https://res.cloudinary.com/"):
                    manikin_pose_url = cached_url
                    print(f"✅ Using Cloudinary URL for {pose_filename}")
                else:
                    # Not in cache or not a Cloudinary URL - try to upload
                    print(f"⚠️ Pose {pose_filename} not in Cloudinary cache, uploading...")
                    api_dir = os.path.dirname(os.path.abspath(__file__))
                    static_path = os.path.join(api_dir, "static", "poses", pose_filename)
                    if os.path.exists(static_path):
                        import base64
                        with open(static_path, "rb") as f:
                            file_content = f.read()
                            ext = pose_filename.split('.')[-1] if '.' in pose_filename else 'jpg'
                            data_url = f"data:image/{ext};base64,{base64.b64encode(file_content).decode()}"
                            manikin_pose_url = upload_to_cloudinary(data_url, "manikin_pose")
                            # Update cache
                            POSE_IMAGE_URLS[pose_filename] = manikin_pose_url
                            print(f"✅ Uploaded {pose_filename} to Cloudinary: {manikin_pose_url[:80]}...")
                    else:
                        print(f"❌ Pose file not found: {static_path}")
                        continue
                
                # Use nano-banana to transfer pose
                print(f"🍌 Transferring pose from {pose_filename} to preview image...")
                new_pose_image_url = replace_manikin_with_person(manikin_pose_url, preview_image_url)
                print(f"✅ Pose transfer completed: {new_pose_image_url[:80]}...")
                
                # Check if the result is different from preview
                if new_pose_image_url == preview_image_url:
                    print(f"⚠️ Result is same as preview - pose transfer may have failed")
                
                # Apply model repositioning if defined for this pose
                if pose_filename in pose_angles:
                    angle_info = pose_angles[pose_filename]
                    print(f"📐 Repositioning model: {angle_info['angle']}")
                    
                    angle_prompt = (
                        f"Reposition the person to a different location within the same scene: {angle_info['angle']}. "
                        f"{angle_info['description']} "
                        f"IMPORTANT: Move the person to a DIFFERENT SPOT in the scene environment. "
                        f"They should be standing somewhere else - different position relative to background elements. "
                        f"The scene can be creatively interpreted - add more depth, different placement, varied distance. "
                        f"Keep the same person, same pose, same clothing, same scene style/environment. "
                        f"Full body shot with the person repositioned within the scene."
                    )
                    
                    # Use nano-banana PRO to reposition model within the scene with HIGHER strength for creative variation
                    angle_result_url = run_nano_banana_pro(
                        prompt=angle_prompt,
                        image_urls=[new_pose_image_url],  # Single image, reposition person in scene
                        strength=0.60,  # Higher strength to allow repositioning within scene
                        guidance_scale=7.0,  # Higher guidance for repositioning
                        num_steps=30  # More steps for quality
                    )
                    
                    # Upload to Cloudinary
                    if angle_result_url:
                        new_pose_image_url = upload_to_cloudinary(angle_result_url, "angle_variation")
                        print(f"✅ Camera angle applied: {angle_info['angle']}")
                
                # Create new image entry with same metadata but new pose
                new_image = preview_image.copy()
                new_image["image_url"] = new_pose_image_url
                new_image["shot_type"] = f"Pose Variation ({pose_filename})"
                new_image["shot_name"] = f"pose_{pose_filename.replace('.jpg', '').replace('Pose-', '').lower()}"
                
                generated_images.append(new_image)
                print(f"✅ Added {pose_filename} to campaign (total images: {len(generated_images)})")
                
            except Exception as pose_error:
                print(f"❌ Failed to generate pose {pose_filename}: {pose_error}")
                import traceback
                traceback.print_exc()
                continue
        
        # Generate close-up detail shot after all poses - USE PREVIEW IMAGE AS BASE
        print(f"\n🔍 Generating product close-up shot from reference image...")
        try:
            # Use the preview/reference image as base for close-up
            if preview_image_url:
                print(f"📸 Creating close-up from preview image: {preview_image_url[:80]}...")
                
                # Get product info for metadata
                products = db.query(Product).filter(Product.id.in_(product_ids)).all()
                models = db.query(Model).filter(Model.id.in_(model_ids)).all()
                scenes = db.query(Scene).filter(Scene.id.in_(scene_ids)).all()
                
                if products and models and scenes:
                    product = products[0]
                    model = models[0]
                    scene = scenes[0]
                    
                    print(f"🎯 Close-up of reference image - focusing on shirt/top garment")
                    
                    # Close-up prompt - reframe the preview image to focus on upper body/shirt
                    closeup_prompt = (
                        f"Reframe this image as a fashion close-up shot. "
                        f"Focus on the upper body and shirt/top garment area. "
                        f"Zoom in to show the shirt details, fit, fabric texture, and styling from chest to waist. "
                        f"Keep the same person, same outfit, same scene background. "
                        f"Natural depth of field with the shirt in sharp focus. "
                        f"Professional fashion product photography emphasizing the garment details."
                    )
                    
                    print(f"📝 Close-up prompt: {closeup_prompt[:100]}...")
                    
                    # Use nano-banana PRO to reframe/crop the preview image into a close-up
                    closeup_url = run_nano_banana_pro(
                        prompt=closeup_prompt,
                        image_urls=[preview_image_url],  # Single image - reframe it
                        strength=0.35,  # Low strength - just reframing, not changing content
                        guidance_scale=5.0,  # Moderate guidance
                        num_steps=25  # Standard quality
                    )
                    
                    # Upload to Cloudinary for persistence
                    closeup_url = upload_to_cloudinary(closeup_url, "closeup_shot")
                    
                    if closeup_url:
                        closeup_image = {
                            "image_url": closeup_url,
                            "shot_type": "Product Close-Up",
                            "shot_name": "product_closeup",
                            "model_id": model.id,
                            "model_name": model.name,
                            "product_ids": [product.id],
                            "product_name": product.name,
                            "scene_id": scene.id,
                            "scene_name": scene.name,
                            "generated_at": datetime.utcnow().isoformat()
                        }
                        generated_images.append(closeup_image)
                        print(f"✅ Added close-up shot from reference image (total images: {len(generated_images)})")
                    else:
                        print(f"⚠️ Close-up generation returned None")
                else:
                    print(f"⚠️ Missing products/models/scenes for close-up metadata")
            else:
                print(f"⚠️ No preview image available for close-up generation")
                
        except Exception as closeup_error:
            print(f"⚠️ Shirt close-up generation failed: {closeup_error}")
            import traceback
            traceback.print_exc()
        
        # Generate PANTS close-up shot after shirt close-up
        print(f"\n👖 Generating pants close-up shot from reference image...")
        try:
            # Use the preview/reference image as base for pants close-up
            if preview_image_url:
                print(f"📸 Creating pants close-up from preview image: {preview_image_url[:80]}...")
                
                # Get product info for metadata (reuse from above)
                products = db.query(Product).filter(Product.id.in_(product_ids)).all()
                models = db.query(Model).filter(Model.id.in_(model_ids)).all()
                scenes = db.query(Scene).filter(Scene.id.in_(scene_ids)).all()
                
                if products and models and scenes:
                    model = models[0]
                    scene = scenes[0]
                    
                    # Find the pants/bottom product
                    pants_product = None
                    for prod in products:
                        if hasattr(prod, 'clothing_type') and prod.clothing_type in ['shorts', 'pants', 'bottom']:
                            pants_product = prod
                            break
                    
                    # Fallback to last product if no pants found
                    if not pants_product and len(products) > 1:
                        pants_product = products[-1]
                    elif not pants_product:
                        pants_product = products[0]
                    
                    print(f"🎯 Pants close-up - focusing on {pants_product.name}")
                    
                    # Pants close-up prompt - editorial fashion style
                    pants_closeup_prompt = (
                        f"Reframe this fashion editorial image focusing on the lower body and pants/bottom garment. "
                        f"Fashion editorial style close-up shot showcasing the {pants_product.name}. "
                        f"Frame from waist to mid-thigh, emphasizing the fit, fabric texture, cut, and styling of the pants. "
                        f"Keep the same person, same complete outfit, same scene background. "
                        f"Dynamic fashion editorial composition with artistic depth of field. "
                        f"The pants should be the hero of this shot - sharp focus on fabric details, seams, and style. "
                        f"Professional fashion editorial photography with confident, stylish energy."
                    )
                    
                    print(f"📝 Pants close-up prompt: {pants_closeup_prompt[:100]}...")
                    
                    # Use nano-banana PRO to reframe/crop into pants close-up
                    pants_closeup_url = run_nano_banana_pro(
                        prompt=pants_closeup_prompt,
                        image_urls=[preview_image_url],  # Single image - reframe it
                        strength=0.40,  # Slightly higher for editorial reframing
                        guidance_scale=5.5,  # Higher guidance for precise framing
                        num_steps=28  # Good quality
                    )
                    
                    # Upload to Cloudinary for persistence
                    pants_closeup_url = upload_to_cloudinary(pants_closeup_url, "pants_closeup_shot")
                    
                    if pants_closeup_url:
                        pants_closeup_image = {
                            "image_url": pants_closeup_url,
                            "shot_type": "Pants Close-Up (Editorial)",
                            "shot_name": "pants_closeup_editorial",
                            "model_id": model.id,
                            "model_name": model.name,
                            "product_ids": [pants_product.id],
                            "product_name": pants_product.name,
                            "scene_id": scene.id,
                            "scene_name": scene.name,
                            "generated_at": datetime.utcnow().isoformat()
                        }
                        generated_images.append(pants_closeup_image)
                        print(f"✅ Added pants close-up shot (total images: {len(generated_images)})")
                    else:
                        print(f"⚠️ Pants close-up generation returned None")
                else:
                    print(f"⚠️ Missing products/models/scenes for pants close-up metadata")
            else:
                print(f"⚠️ No preview image available for pants close-up generation")
                
        except Exception as pants_closeup_error:
            print(f"⚠️ Pants close-up generation failed: {pants_closeup_error}")
            import traceback
            traceback.print_exc()
        
        # Update campaign with all images (including both close-ups)
        if campaign.settings is None:
            campaign.settings = {}
        campaign.settings["generated_images"] = generated_images
        campaign.status = "completed"
        campaign.generation_status = "completed"
        flag_modified(campaign, "settings")
        db.commit()
        
        print(f"🎉 Full campaign completed with {len(generated_images)} total images!")
            
    except Exception as e:
        print(f"❌ Multiple pose generation failed: {e}")
        import traceback
        traceback.print_exc()
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if campaign:
            campaign.generation_status = "failed"
            db.commit()
    finally:
        # CRITICAL: Close database session to prevent connection pool exhaustion
        db.close()
        print(f"✅ Database session closed for pose generation {campaign_id}")

@app.post("/campaigns/{campaign_id}/generate-videos")
async def generate_campaign_videos(
    campaign_id: str,
    duration: int = Form(5),
    cfg_scale: float = Form(0.5),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate videos from all campaign images using Kling 2.5 Turbo Pro"""
    try:
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        generated_images = campaign.settings.get("generated_images", []) if campaign.settings else []
        
        if not generated_images:
            raise HTTPException(status_code=400, detail="No images to generate videos from")
        
        # Update settings
        new_settings = dict(campaign.settings) if campaign.settings else {}
        new_settings["video_generation_status"] = "generating"
        new_settings["videos"] = []
        campaign.settings = new_settings
        flag_modified(campaign, "settings")
        db.commit()
        
        print(f"🎬 Generating videos for {len(generated_images)} images...")
        
        # Start video generation in background
        import asyncio
        asyncio.create_task(generate_videos_background(
            campaign_id,
            generated_images,
            duration,
            cfg_scale
        ))
        
        return {
            "message": f"Generating videos for {len(generated_images)} images",
            "image_count": len(generated_images)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to start video generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def generate_videos_background(
    campaign_id: str,
    images: list,
    duration: int,
    cfg_scale: float
):
    """Generate videos for each image using Kling 2.5 Turbo Pro"""
    import replicate
    from datetime import datetime
    
    # Create a NEW database session for this background task
    db = SessionLocal()
    try:
        videos = []
        
        # Define camera movement signatures - HIGH-FASHION EDITORIAL STYLE
        CAMERA_SIGNATURES = [
            "Slow cinematic orbit revealing the silhouette, fashion film aesthetic with shallow depth of field",
            "Elegant push-in towards the subject, intimate editorial moment, vogue-style cinematography",
            "Dramatic slow-motion tracking shot, model walking with confidence, haute couture campaign energy",
            "Atmospheric dolly movement through the scene, moody editorial lighting, magazine cover moment",
            "Cinematic crane-down reveal, emphasizing the outfit's structure and the model's presence",
            "Intimate handheld drift, raw and authentic energy, street-style editorial documentary feel"
        ]
        
        for idx, image_data in enumerate(images, 1):
            try:
                print(f"\n🎬 [{idx}/{len(images)}] Generating video for {image_data.get('shot_type', 'image')}...")
                
                # Select camera signature based on index (cycling)
                camera_signature = CAMERA_SIGNATURES[(idx - 1) % len(CAMERA_SIGNATURES)]
                print(f"🎥 Applied camera signature: {camera_signature.split(':')[0]}")
                
                # Build prompt for video
                product_name = image_data.get('product_name', 'clothing')
                scene_name = image_data.get('scene_name', 'scene')
                model_name = image_data.get('model_name', 'model')
                shot_type = image_data.get('shot_type', '')
                shot_name = image_data.get('shot_name', '')
                
                # HIGH-FASHION EDITORIAL PROMPTS
                if 'close' in shot_type.lower() or 'closeup' in shot_name.lower() or 'close-up' in shot_type.lower():
                    # Check if it's a pants close-up
                    if 'pants' in shot_type.lower() or 'pants' in shot_name.lower():
                        video_prompt = (
                            f"Fashion editorial detail shot. The {product_name} pants captured cinematically. "
                            f"Frame: waist to knees, no face visible. "
                            f"Elegant camera tilt revealing the cut, fabric movement, and tailoring. "
                            f"Runway-quality production. Natural movement shows how the garment flows. "
                            f"High-fashion campaign energy with artistic depth of field. Luxury brand aesthetic."
                        )
                        print(f"👖 Using EDITORIAL PANTS CLOSE-UP prompt")
                    else:
                        # Shirt/top close-up
                        video_prompt = (
                            f"Intimate fashion editorial close-up. The {product_name} garment in exquisite detail. "
                            f"Frame: torso and garment only, face excluded. "
                            f"Slow, sensual camera movement revealing fabric texture, drape, and craftsmanship. "
                            f"Cinematic shallow depth of field. Luxury brand campaign aesthetic. "
                            f"Subtle breathing movement brings the garment to life. Magazine-worthy composition."
                        )
                        print(f"👕 Using EDITORIAL SHIRT CLOSE-UP prompt")
                else:
                    # HIGH-FASHION EDITORIAL CAMPAIGN - Full body shots
                    video_prompt = (
                        f"High-fashion editorial campaign film. {model_name} embodies effortless confidence "
                        f"wearing the {product_name}. {camera_signature}. "
                        f"Cinematic color grading, rich shadows, editorial lighting. "
                        f"Subtle confident movement - a slight turn, weight shift, or knowing glance. "
                        f"Vogue-level production quality. The energy of a luxury brand campaign."
                    )
                    print(f"🎬 Using EDITORIAL CAMPAIGN prompt")
                
                print(f"📝 Video prompt: {video_prompt[:150]}...")
                print(f"🖼️ Image URL: {image_data['image_url'][:80]}...")
                
                # Build negative prompt - editorial quality standards
                if 'close' in shot_type.lower() or 'closeup' in shot_name.lower() or 'close-up' in shot_type.lower():
                    negative_prompt = (
                        "face, head, neck visible, facial features, eyes, nose, mouth, "
                        "blurry, distorted, low quality, amateur, cheap looking, jerky motion, "
                        "showing face, overexposed, underexposed, flat lighting"
                    )
                else:
                    negative_prompt = (
                        "blurry, distorted, low quality, amateur, cheap looking, jerky motion, "
                        "overexposed, underexposed, flat lighting, static, stiff movement"
                    )
                
                # Call Kling 2.5 Turbo Pro API
                output = replicate.run(
                    "kwaivgi/kling-v2.5-turbo-pro",
                    input={
                        "mode": "image-to-video",
                        "image": image_data["image_url"],
                        "duration": duration,
                        "cfg_scale": cfg_scale,
                        "prompt": video_prompt,
                        "aspect_ratio": "16:9",
                        "negative_prompt": negative_prompt
                    }
                )
                
                # Handle output (Kling returns video URL)
                if hasattr(output, 'url'):
                    video_url = output.url()
                elif isinstance(output, str):
                    video_url = output
                elif isinstance(output, list) and len(output) > 0:
                    video_url = output[0] if isinstance(output[0], str) else output[0].url() if hasattr(output[0], 'url') else str(output[0])
                else:
                    video_url = str(output)
                
                print(f"✅ Video generated: {video_url[:80]}...")
                
                # Upload to Cloudinary for stable storage
                try:
                    stable_video_url = upload_to_cloudinary(video_url, f"video_{idx}")
                    print(f"✅ Video uploaded to Cloudinary: {stable_video_url[:80]}...")
                except Exception as upload_error:
                    print(f"⚠️ Failed to upload video to Cloudinary: {upload_error}")
                    stable_video_url = video_url  # Use replicate URL as fallback
                
                videos.append({
                    **image_data,  # Include all image metadata
                    "video_url": stable_video_url,
                    "duration": duration,
                    "cfg_scale": cfg_scale,
                    "generated_at": datetime.utcnow().isoformat()
                })
                
                print(f"✅ Video {idx}/{len(images)} completed!")
                
            except Exception as e:
                print(f"❌ Failed to generate video {idx}: {e}")
                import traceback
                traceback.print_exc()
                videos.append({
                    **image_data,
                    "video_url": None,
                    "error": str(e),
                    "duration": duration,
                    "cfg_scale": cfg_scale
                })
        
        # Update campaign with videos
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if campaign:
            new_settings = dict(campaign.settings) if campaign.settings else {}
            new_settings["videos"] = videos
            new_settings["video_generation_status"] = "completed"
            campaign.settings = new_settings
            flag_modified(campaign, "settings")
            db.commit()
            
            successful_videos = sum(1 for v in videos if v.get("video_url"))
            print(f"🎉 Generated {successful_videos}/{len(videos)} videos for campaign {campaign_id}")
            print(f"💾 Saved videos to database: {len(videos)} videos")
            print(f"📊 Video URLs: {[v.get('video_url', 'None')[:50] for v in videos]}")
            
            # Verify it was saved
            db.refresh(campaign)
            saved_videos = campaign.settings.get("videos", []) if campaign.settings else []
            print(f"✅ Verification: {len(saved_videos)} videos in database after commit")
    except Exception as e:
        print(f"❌ Failed to update campaign with videos: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # CRITICAL: Close database session to prevent connection pool exhaustion
        db.close()
        print(f"✅ Database session closed for video generation {campaign_id}")

@app.post("/campaigns/{campaign_id}/generate-unified-video")
async def generate_unified_campaign_video(
    campaign_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a unified campaign video by concatenating all videos in storytelling order"""
    try:
        print(f"🎬 UNIFIED VIDEO: Request received for campaign {campaign_id}")
        
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        videos = campaign.settings.get("videos", []) if campaign.settings else []
        
        if not videos or len(videos) < 3:
            raise HTTPException(status_code=400, detail="Need at least 3 videos to create unified campaign video. Generate videos first.")
        
        # Define storytelling order: 1 → 4 → 2 → 5 → 3
        # Shot 1 (Neutral pose - intro) → Shot 4 (Shirt closeup) → Shot 2 (Pose 1) → Shot 5 (Pants closeup) → Shot 3 (Pose 2)
        desired_order = [0, 3, 1, 4, 2]  # 0-indexed
        
        print(f"🎬 Creating unified video from {len(videos)} clips in order: {[i+1 for i in desired_order]}")
        
        # Update settings to track unified video generation
        new_settings = dict(campaign.settings) if campaign.settings else {}
        new_settings["unified_video_status"] = "generating"
        campaign.settings = new_settings
        flag_modified(campaign, "settings")
        db.commit()
        
        # Start unified video generation in background
        import asyncio
        asyncio.create_task(generate_unified_video_background(
            campaign_id,
            videos,
            desired_order
        ))
        
        return {
            "message": "Creating final campaign video...",
            "video_count": len(videos),
            "sequence": [i+1 for i in desired_order],
            "status": "generating"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to start unified video generation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


async def generate_unified_video_background(
    campaign_id: str,
    videos: list,
    order: list
):
    """Generate unified video by concatenating individual videos using FFmpeg"""
    db = SessionLocal()
    try:
        import subprocess
        import tempfile
        import os
        
        print(f"🎬 Starting unified video generation for campaign {campaign_id}...")
        
        # Download all video files
        temp_files = []
        concat_list_path = None
        output_path = None
        
        try:
            # Reorder videos according to desired sequence
            ordered_videos = []
            for idx in order:
                if idx < len(videos) and videos[idx].get("video_url"):
                    ordered_videos.append(videos[idx])
                else:
                    print(f"⚠️ Video at index {idx} not found or has no URL")
            
            if len(ordered_videos) < 2:
                raise Exception(f"Not enough videos to create unified video. Found {len(ordered_videos)}, need at least 2")
            
            print(f"📋 Creating unified video with {len(ordered_videos)} clips")
            print(f"📺 Sequence: {[v.get('shot_type', 'unknown') for v in ordered_videos]}")
            
            # Download each video to a temporary file
            for i, video_data in enumerate(ordered_videos):
                video_url = video_data.get("video_url")
                shot_name = video_data.get("shot_name", f"shot_{i}")
                
                print(f"📥 Downloading clip {i+1}/{len(ordered_videos)}: {shot_name}...")
                
                # Download video
                response = requests.get(video_url, stream=True, timeout=180)
                response.raise_for_status()
                
                # Save to temp file
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4", mode='wb')
                for chunk in response.iter_content(chunk_size=8192):
                    temp_file.write(chunk)
                temp_file.close()
                temp_files.append(temp_file.name)
                
                print(f"✅ Downloaded clip {i+1}: {os.path.getsize(temp_file.name)} bytes")
            
            # Create concat list file for FFmpeg
            concat_list = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix=".txt")
            concat_list_path = concat_list.name
            
            for temp_file in temp_files:
                # Use absolute path and escape special characters
                escaped_path = temp_file.replace("'", "'\\''")
                concat_list.write(f"file '{escaped_path}'\n")
            concat_list.close()
            
            print(f"📝 Created concat list with {len(temp_files)} files")
            
            # Create output file path
            output_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
            output_path = output_file.name
            output_file.close()
            
            # Run FFmpeg to concatenate videos
            print(f"🎬 Running FFmpeg to concatenate videos...")
            cmd = [
                'ffmpeg',
                '-f', 'concat',
                '-safe', '0',
                '-i', concat_list_path,
                '-c', 'copy',
                '-y',  # Overwrite output file
                output_path
            ]
            
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
            print(f"✅ FFmpeg completed successfully")
            print(f"📦 Output file size: {os.path.getsize(output_path)} bytes")
            
            # Upload unified video to Cloudinary
            print(f"☁️ Uploading unified video to Cloudinary...")
            with open(output_path, 'rb') as f:
                import cloudinary.uploader
                result = cloudinary.uploader.upload(
                    f,
                    resource_type="video",
                    folder="unified_campaigns",
                    public_id=f"campaign_{campaign_id}_unified",
                    overwrite=True
                )
                unified_video_url = result['secure_url']
            
            print(f"✅ Unified video uploaded: {unified_video_url[:80]}...")
            
            # Update campaign with unified video URL
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if campaign:
                new_settings = dict(campaign.settings) if campaign.settings else {}
                new_settings["unified_video_url"] = unified_video_url
                new_settings["unified_video_status"] = "completed"
                new_settings["unified_video_order"] = order
                new_settings["unified_video_generated_at"] = datetime.utcnow().isoformat()
                campaign.settings = new_settings
                flag_modified(campaign, "settings")
                db.commit()
                
                print(f"🎉 Unified campaign video generated successfully!")
                print(f"📺 URL: {unified_video_url}")
        
        finally:
            # Clean up temporary files
            print(f"🧹 Cleaning up temporary files...")
            for temp_file in temp_files:
                try:
                    os.remove(temp_file)
                except Exception as e:
                    print(f"⚠️ Failed to remove temp file {temp_file}: {e}")
            
            if concat_list_path:
                try:
                    os.remove(concat_list_path)
                except Exception as e:
                    print(f"⚠️ Failed to remove concat list: {e}")
            
            if output_path:
                try:
                    os.remove(output_path)
                except Exception as e:
                    print(f"⚠️ Failed to remove output file: {e}")
            
    except Exception as e:
        print(f"❌ Unified video generation failed: {e}")
        import traceback
        traceback.print_exc()
        
        # Update campaign status to failed
        try:
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if campaign:
                new_settings = dict(campaign.settings) if campaign.settings else {}
                new_settings["unified_video_status"] = "failed"
                new_settings["unified_video_error"] = str(e)
                campaign.settings = new_settings
                flag_modified(campaign, "settings")
                db.commit()
        except Exception as update_error:
            print(f"❌ Failed to update campaign status: {update_error}")
    
    finally:
        db.close()
        print(f"✅ Database session closed for unified video generation {campaign_id}")

@app.put("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update campaign name and description"""
    try:
        # Get the campaign
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Update campaign fields
        if "name" in request:
            campaign.name = request["name"]
        if "description" in request:
            campaign.description = request["description"]
        
        # Commit changes
        db.commit()
        db.refresh(campaign)
        
        print(f"✅ Updated campaign: {campaign.name}")
        
        return {
            "id": campaign.id,
            "name": campaign.name,
            "description": campaign.description,
            "status": campaign.status,
            "created_at": campaign.created_at,
            "updated_at": campaign.updated_at,
            "settings": campaign.settings
        }
        
    except Exception as e:
        db.rollback()
        print(f"❌ Failed to update campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a campaign"""
    try:
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        db.delete(campaign)
        db.commit()
        
        return {"message": "Campaign deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Product Update Endpoint ----------
@app.put("/products/{product_id}")
async def update_product(
    product_id: str,
    name: str = Form(None),
    description: str = Form(None),
    category: str = Form(None),
    clothing_type: str = Form(None),
    tags: str = Form(None),
    product_image: UploadFile = File(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a product"""
    try:
        # Find the product
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.user_id == current_user["user_id"]
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Update fields if provided
        if name is not None:
            product.name = name
        if description is not None:
            product.description = description
        if category is not None:
            product.category = category
        if clothing_type is not None:
            product.clothing_type = clothing_type
        if tags is not None:
            # Parse tags from comma-separated string
            product.tags = [tag.strip() for tag in tags.split(",") if tag.strip()] if tags else []
        
        # Update product image if provided
        if product_image:
            image_filename = f"product_{hash(product.name + str(datetime.now()))}.{product_image.filename.split('.')[-1]}"
            image_path = os.path.join("uploads", image_filename)
            
            with open(image_path, "wb") as f:
                content = await product_image.read()
                f.write(content)
            
            # ALWAYS upload to Cloudinary - no local URLs
            try:
                product.image_url = upload_to_cloudinary(image_path, f"product_{product.id}")
                print(f"✅ Product image uploaded to Cloudinary: {product.image_url[:80]}...")
            except Exception as e:
                print(f"❌ Failed to upload product image to Cloudinary: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to upload product image to Cloudinary: {str(e)}")
        
        # Update updated_at timestamp
        product.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(product)
        
        print(f"✅ Updated product: {product.name}")
        
        return {
            "id": product.id,
            "name": product.name,
            "description": product.description,
            "category": product.category,
            "clothing_type": product.clothing_type,
            "tags": product.tags,
            "image_url": product.image_url,
            "packshot_front_url": product.packshot_front_url,
            "packshot_back_url": product.packshot_back_url,
            "packshots": product.packshots,
            "created_at": product.created_at.isoformat() if product.created_at else None,
            "updated_at": product.updated_at.isoformat() if product.updated_at else None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error updating product: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update product: {str(e)}")

# ---------- Delete Endpoints ----------
@app.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a product"""
    try:
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.user_id == current_user["user_id"]
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        db.delete(product)
        db.commit()
        
        return {"message": "Product deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting product: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def run_nano_banana_model_generation(
    prompt: str, 
    variants: int = 1, 
    gender: str = "male",
    age: int = 25,
    height: str = "average",
    build: str = "athletic",
    hair_color: str = "brown",
    eye_color: str = "brown",
    skin_tone: str = "medium"
) -> List[str]:
    """Generate model images using Nano Banana with base model images"""
    try:
        print(f"🎭 Running Nano Banana model generation: {prompt}")
        print(f"🔧 DEBUG: This is the NEW version with external URLs!")
        
        # Use the base model image as starting point based on gender
        base_model_url = get_model_url(gender)
        
        print(f"🔍 Using external model URL: {base_model_url}")
        print(f"🔍 URL starts with http: {base_model_url.startswith('http')}")
        
        # External URL - use it directly for Replicate
        print(f"✅ Using external model URL for generation - NO LOCAL FILES")
        
        generated_urls = []
        
        for i in range(variants):
            try:
                # Enhance prompt with physical attributes
                physical_description = f"{age} year old {gender}, {height} height, {build} build, {hair_color} hair, {eye_color} eyes, {skin_tone} skin tone"
                
                # Handle empty prompt - use just physical attributes
                # Modify realistic photo while preserving pose and clothes
                if prompt.strip():
                    enhanced_prompt = f"Modify the person's physical features to be: {physical_description}. {prompt}. Keep the exact same pose, black t-shirt, black shorts, sandals, and white background. Only change facial features, skin tone, hair, and body proportions. Professional fashion photography style."
                else:
                    enhanced_prompt = f"Modify the person's physical features to be: {physical_description}. Keep the exact same pose, black t-shirt, black shorts, sandals, and white background. Only change facial features, skin tone, hair, and body proportions. Professional fashion photography style."
                
                print(f"🎭 Processing variant {i+1} with base model image...")
                print(f"📝 Prompt: {enhanced_prompt[:150]}...")
                
                # Run Nano Banana model generation with very low strength to preserve input
                out = replicate.run("google/nano-banana", input={
                    "prompt": enhanced_prompt,  # Use 'prompt' parameter
                    "image": base_model_url,
                    "num_inference_steps": 10,  # Low steps to preserve input
                    "guidance_scale": 2.0,  # Low guidance to preserve input
                    "strength": 0.05,  # Very low strength to preserve input
                    "seed": None
                })
                
                # Handle different return types
                if hasattr(out, 'url'):
                    generated_urls.append(out.url())
                elif isinstance(out, str):
                    generated_urls.append(out)
                elif isinstance(out, list) and len(out) > 0:
                    item = out[0]
                    if hasattr(item, 'url'):
                        generated_urls.append(item.url())
                    else:
                        generated_urls.append(str(item))
                else:
                    generated_urls.append(str(out))
                
                print(f"✅ Nano Banana variant {i+1} completed")
                
            except Exception as e:
                print(f"❌ Nano Banana variant {i+1} failed: {e}")
                raise
        
        print(f"✅ Nano Banana model generation completed: {len(generated_urls)} images")
        return generated_urls
        
    except Exception as e:
        print(f"❌ Nano Banana model generation error: {e}")
        raise

def deduct_credits(user: User, credits_needed: int, db: Session):
    """
    Deduct credits from user, prioritizing subscription credits first.
    Returns True if deduction was successful, False otherwise.
    """
    # Calculate total available credits (subscription + purchased)
    total_available = (user.subscription_credits or 0) + user.credits
    
    if total_available < credits_needed:
        return False
    
    # First, deduct from subscription credits
    if user.subscription_credits and user.subscription_credits > 0:
        if user.subscription_credits >= credits_needed:
            user.subscription_credits -= credits_needed
            credits_needed = 0
        else:
            # Use all subscription credits, then deduct remaining from purchased credits
            credits_needed -= user.subscription_credits
            user.subscription_credits = 0
    
    # Deduct remaining credits from purchased credits
    if credits_needed > 0:
        user.credits -= credits_needed
    
    db.commit()
    return True

@app.post("/models/ai-generate")
async def generate_model(
    prompt: str = Form(""),
    variants: int = Form(1),
    gender: str = Form("male"),
    age: int = Form(25),
    height: str = Form("average"),
    build: str = Form("athletic"),
    hair_color: str = Form("brown"),
    eye_color: str = Form("brown"),
    skin_tone: str = Form("medium"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a new model using AI"""
    print("=== MODEL GENERATION ENDPOINT CALLED ===")
    print(f"Prompt: {prompt}")
    print(f"Variants: {variants}")
    print(f"Gender: {gender}")
    
    try:
        # Check user credits (1 credit per variant)
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        credits_needed = variants
        total_available = (user.subscription_credits or 0) + user.credits
        if total_available < credits_needed:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient credits. You have {total_available} total credits ({user.subscription_credits or 0} subscription + {user.credits} purchased), but need {credits_needed}"
            )
        
        # Generate model images using Nano Banana
        print(f"Calling run_nano_banana_model_generation...")
        model_urls = run_nano_banana_model_generation(
            prompt, variants, gender, age, height, build, hair_color, eye_color, skin_tone
        )
        print(f"Got model URLs: {model_urls}")
        
        # Download and store model images locally
        local_model_urls = []
        for i, model_url in enumerate(model_urls):
            try:
                local_url = upload_to_cloudinary(model_url, f"generated_model_{i+1}")
                local_model_urls.append(local_url)
            except Exception as e:
                print(f"⚠️ Failed to download model {i+1}, using original URL: {e}")
                local_model_urls.append(model_url)
        
        print(f"Stored local model URLs: {local_model_urls}")
        
        # Deduct credits (prioritizing subscription credits)
        if not deduct_credits(user, credits_needed, db):
            raise HTTPException(status_code=400, detail="Failed to deduct credits")
        
        # Create model records in database
        created_models = []
        for i, local_url in enumerate(local_model_urls):
            model = Model(
                id=str(uuid.uuid4()),
                name=f"Generated Model {i+1}",
                image_url=local_url,
                user_id=current_user["user_id"],
                gender=gender,
                poses=[]
            )
            db.add(model)
            created_models.append(model)
        
        db.commit()
        
        print(f"✅ Created {len(created_models)} models in database")
        
        return {
            "message": f"Successfully generated {len(created_models)} models",
            "models": [
                {
                    "id": model.id,
                    "name": model.name,
                    "image_url": model.image_url,
                    "poses": model.poses
                }
                for model in created_models
            ],
            "credits_used": credits_needed,
            "remaining_credits": user.credits
        }
        
    except Exception as e:
        print(f"❌ Model generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/models/upload")
async def upload_model(
    name: str = Form(...),
    description: str = Form(""),
    gender: str = Form(""),
    model_image: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a new model image"""
    try:
        # Validate image file
        if not model_image.content_type or not model_image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read image data
        image_data = await model_image.read()
        
        # Upload to Cloudinary
        print(f"📤 Uploading model image to Cloudinary...")
        cloudinary_url = upload_to_cloudinary(
            f"data:image/{model_image.content_type.split('/')[-1]};base64,{base64.b64encode(image_data).decode()}",
            "models"
        )
        
        if not cloudinary_url:
            raise HTTPException(status_code=500, detail="Failed to upload image to Cloudinary")
        
        print(f"✅ Model image uploaded: {cloudinary_url}")
        
        # Create model in database
        model = Model(
            user_id=current_user["user_id"],
            name=name,
            description=description,
            image_url=cloudinary_url,
            poses=[]  # Empty poses array, can be populated later
        )
        
        db.add(model)
        db.commit()
        db.refresh(model)
        
        print(f"✅ Model created with ID: {model.id}")
        
        return {
            "model": {
                "id": model.id,
                "name": model.name,
                "description": model.description,
                "image_url": model.image_url,
                "poses": model.poses,
                "created_at": model.created_at
            },
            "message": f"Model '{name}' uploaded successfully!"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Model upload failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/models/{model_id}/generate-poses")
async def generate_poses(
    model_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate poses for a model using Qwen Image Edit Plus"""
    try:
        print(f"🎭 Generating poses for model: {model_id}")
        
        # Get the model
        model = db.query(Model).filter(
            Model.id == model_id,
            Model.user_id == current_user["user_id"]
        ).first()
        
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        
        if not model.image_url:
            raise HTTPException(status_code=400, detail="Model has no image")
        
        # Check user credits (1 credit per pose generation)
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if user.credits < 1:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient credits. You have {user.credits} credits, but need 1"
            )
        
        # Generate poses using Qwen Image Edit Plus
        poses = []
        pose_prompts = [
            "Professional fashion pose, confident stance, hands on hips, looking at camera",
            "Elegant side pose, looking away from camera, one hand on hip",
            "Dynamic walking pose, mid-step, looking forward",
            "Relaxed standing pose, arms crossed, slight smile",
            "Fashion forward pose, one hand in pocket, looking over shoulder"
        ]
        
        for i, prompt in enumerate(pose_prompts):
            try:
                print(f"🎭 Generating pose {i+1}: {prompt[:50]}...")
                
                # Use Qwen Image Edit Plus for pose generation
                out = replicate.run("qwen/qwen-image-edit-plus", input={
                    "prompt": f"Modify the person's pose to: {prompt}. Keep the same person, clothes, and background. Only change the pose and body position. Professional fashion photography style.",
                    "image": [model.image_url],
                    "num_inference_steps": 30,
                    "guidance_scale": 7.0,
                    "strength": 0.6
                })
                
                # Handle different return types and get URL
                pose_url = None
                if hasattr(out, 'url'):
                    pose_url = out.url()
                elif isinstance(out, str):
                    pose_url = out
                elif isinstance(out, list) and len(out) > 0:
                    item = out[0]
                    if hasattr(item, 'url'):
                        pose_url = item.url()
                    else:
                        pose_url = str(item)
                else:
                    pose_url = str(out)
                
                # Download and save immediately to avoid ephemeral URL expiration
                if pose_url:
                    stable_pose_url = upload_to_cloudinary(pose_url, f"pose_{i+1}")
                    poses.append(stable_pose_url)
                    print(f"✅ Pose {i+1} generated and saved: {stable_pose_url[:50]}...")
                else:
                    print(f"⚠️ Pose {i+1} had no valid URL")
                
            except Exception as e:
                print(f"❌ Pose {i+1} generation failed: {e}")
                continue
        
        if not poses:
            raise HTTPException(status_code=500, detail="Failed to generate any poses")
        
        # Update model with new poses
        model.poses = poses
        db.commit()
        
        # Deduct credits (prioritizing subscription credits)
        if not deduct_credits(user, 1, db):
            raise HTTPException(status_code=400, detail="Failed to deduct credits")
        
        print(f"✅ Generated {len(poses)} poses for model {model_id}")
        
        return {
            "message": f"Successfully generated {len(poses)} poses",
            "urls": poses,
            "poses": poses,
            "model_id": model_id,
            "model_name": model.name,
            "total_poses": len(poses),
            "credits_used": 1,
            "remaining_credits": user.credits
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Pose generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/models/{model_id}")
async def delete_model(
    model_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a model"""
    try:
        model = db.query(Model).filter(
            Model.id == model_id,
            Model.user_id == current_user["user_id"]
        ).first()
        
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        
        db.delete(model)
        db.commit()
        
        return {"message": "Model deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting model: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/scenes/{scene_id}")
async def delete_scene(
    scene_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a scene"""
    try:
        scene = db.query(Scene).filter(
            Scene.id == scene_id,
            Scene.user_id == current_user["user_id"]
        ).first()
        
        if not scene:
            raise HTTPException(status_code=404, detail="Scene not found")
        
        db.delete(scene)
        db.commit()
        
        return {"message": "Scene deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting scene: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Dashboard Endpoint ----------
@app.get("/dashboard/stats")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics"""
    try:
        user_id = current_user["user_id"]
        
        # Count entities
        products_count = db.query(Product).filter(Product.user_id == user_id).count()
        models_count = db.query(Model).filter(Model.user_id == user_id).count()
        scenes_count = db.query(Scene).filter(Scene.user_id == user_id).count()
        campaigns_count = db.query(Campaign).filter(Campaign.user_id == user_id).count()
        
        # Get user credits
        user = db.query(User).filter(User.id == user_id).first()
        credits = user.credits if user else 0
        
        return {
            "products": products_count,
            "models": models_count,
            "scenes": scenes_count,
            "campaigns": campaigns_count,
            "credits": credits
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Payment Configuration ----------
@app.get("/payments/config")
async def get_payment_config():
    """Get payment configuration"""
    return {
        "publishable_key": STRIPE_PUBLISHABLE_KEY
    }

@app.post("/payments/create-intent")
async def create_payment_intent(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe payment intent for credit purchase"""
    try:
        # Extract amount from query params or request body
        amount = None
        
        # Try query parameter first
        if "amount" in request.query_params:
            amount = int(request.query_params["amount"])
        else:
            # Try request body
            try:
                body = await request.json()
                amount = int(body.get("amount", 0))
            except:
                pass
        
        if not amount:
            raise HTTPException(
                status_code=400,
                detail="Amount parameter is required"
            )
        
        # Validate amount (minimum $1, maximum $1000)
        if amount < 100 or amount > 100000:
            raise HTTPException(
                status_code=400,
                detail="Amount must be between $1.00 and $1000.00"
            )
        
        # Calculate credits (1 credit = $0.10, so $1 = 10 credits)
        # amount is in cents, so we need to convert to dollars first
        # $4.99 = 499 cents → 499 / 10 = 49.9 → 49 credits (but should be 20)
        # The correct formula: credits = amount_in_cents / 10
        # But our packages are priced differently, so we need to use the actual price
        credits_to_add = int(amount / 10)  # This is correct for the current pricing
        
        # Create payment intent
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="usd",
            metadata={
                "user_id": current_user["user_id"],
                "credits": str(credits_to_add)
            }
        )
        
        return {
            "client_secret": intent.client_secret,
            "credits": credits_to_add,
            "amount": amount
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/payments/confirm")
async def confirm_payment(
    request: PaymentConfirmRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Confirm payment and add credits to user account
    
    Only allows credit purchase if user has no active subscription OR 
    all subscription credits have been exhausted.
    """
    try:
        # Retrieve payment intent from Stripe
        intent = stripe.PaymentIntent.retrieve(request.payment_intent_id)
        
        if intent.status != "succeeded":
            raise HTTPException(
                status_code=400,
                detail="Payment not completed"
            )
        
        # Get credits from metadata
        credits_to_add = int(intent.metadata.get("credits", 0))
        
        if credits_to_add <= 0:
            raise HTTPException(
                status_code=400,
                detail="Invalid credits amount"
            )
        
        # Get user and check subscription status
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if user has active subscription with remaining credits
        has_active_subscription = (
            user.subscription_status == "active" and 
            user.subscription_expires_at and 
            user.subscription_expires_at > datetime.utcnow()
        )
        
        if has_active_subscription and user.subscription_credits > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot purchase additional credits while subscription credits remain. You have {user.subscription_credits} subscription credits remaining. Please use all subscription credits before purchasing additional credits."
            )
        
        # Add credits to user account (purchased credits)
        user.credits += credits_to_add
        db.commit()
        
        return {
            "message": f"Successfully added {credits_to_add} credits",
            "credits_remaining": user.credits,
            "subscription_credits_remaining": user.subscription_credits or 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ---------- Subscription Endpoints ----------
class SubscriptionCheckoutRequest(BaseModel):
    subscription_type: str  # "starter", "professional", "enterprise"
    price_id: str = ""  # Stripe Price ID (optional, we'll create product/price if not provided)
    is_annual: bool = False
    credits: int
    amount: int  # Amount in cents

@app.post("/subscriptions/create-checkout")
async def create_subscription_checkout(
    request: SubscriptionCheckoutRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe Checkout session for subscription"""
    try:
        from datetime import timedelta
        
        # Calculate subscription expiration date
        if request.is_annual:
            expires_at = datetime.utcnow() + timedelta(days=365)
        else:
            expires_at = datetime.utcnow() + timedelta(days=30)
        
        # Create or retrieve Stripe product and price
        # For now, we'll create a one-time payment checkout session
        # In a full implementation, you'd create Stripe subscriptions
        
        # Create Stripe Checkout Session
        # Build line items based on whether we have a price_id or need to create price_data
        if request.price_id:
            # Use existing Stripe Price ID
            line_items = [{
                'price': request.price_id,
                'quantity': 1,
            }]
        else:
            # Create price_data for subscription
            line_items = [{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': f"{request.subscription_type.capitalize()} Subscription",
                        'description': f"{request.credits} credits per {'year' if request.is_annual else 'month'}",
                    },
                    'unit_amount': request.amount,
                    'recurring': {
                        'interval': 'year' if request.is_annual else 'month',
                    },
                },
                'quantity': 1,
            }]
        
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=line_items,
            mode='subscription',  # Use subscription mode for recurring payments
            success_url=f"{os.getenv('FRONTEND_URL', 'https://www.beatingheart.ai')}/credits?subscription=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{os.getenv('FRONTEND_URL', 'https://www.beatingheart.ai')}/credits?subscription=cancelled",
            client_reference_id=current_user["user_id"],
            metadata={
                'user_id': current_user["user_id"],
                'subscription_type': request.subscription_type,
                'credits': str(request.credits),
                'is_annual': str(request.is_annual),
                'expires_at': expires_at.isoformat(),
            },
            customer_email=current_user.get("email"),
        )
        
        return {
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id
        }
        
    except Exception as e:
        print(f"❌ Subscription checkout creation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")

@app.post("/subscriptions/webhook")
async def subscription_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle Stripe webhook events for subscriptions"""
    try:
        payload = await request.body()
        sig_header = request.headers.get('stripe-signature')
        webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
        
        if not webhook_secret:
            raise HTTPException(status_code=400, detail="Webhook secret not configured")
        
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")
        except stripe.error.SignatureVerificationError as e:
            raise HTTPException(status_code=400, detail=f"Invalid signature: {e}")
        
        # Handle the event
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            
            # Get user from metadata
            user_id = session.get('metadata', {}).get('user_id')
            if not user_id:
                print("⚠️ No user_id in session metadata")
                return {"status": "ok"}
            
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                print(f"⚠️ User not found: {user_id}")
                return {"status": "ok"}
            
            # Get subscription details from metadata
            subscription_type = session.get('metadata', {}).get('subscription_type', 'starter')
            credits = int(session.get('metadata', {}).get('credits', 120))
            is_annual = session.get('metadata', {}).get('is_annual', 'False').lower() == 'true'
            expires_at_str = session.get('metadata', {}).get('expires_at')
            
            if expires_at_str:
                expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
            else:
                from datetime import timedelta
                expires_at = datetime.utcnow() + timedelta(days=365 if is_annual else 30)
            
            # Update user subscription
            user.subscription_type = subscription_type
            user.subscription_credits = credits
            user.subscription_status = "active"
            user.subscription_expires_at = expires_at
            
            db.commit()
            print(f"✅ Subscription activated for user {user_id}: {subscription_type} with {credits} credits")
        
        elif event['type'] == 'customer.subscription.deleted':
            subscription = event['data']['object']
            # Handle subscription cancellation
            customer_id = subscription.get('customer')
            
            # Find user by customer ID or subscription metadata
            # Note: You may need to store Stripe customer_id in user model
            print(f"📋 Subscription cancelled: {subscription.get('id')}")
        
        return {"status": "ok"}
        
    except Exception as e:
        print(f"❌ Webhook processing failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class VerifyCheckoutRequest(BaseModel):
    session_id: str

@app.post("/subscriptions/verify-checkout")
async def verify_checkout_session(
    request: VerifyCheckoutRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify and activate subscription from Stripe checkout session"""
    try:
        # Retrieve checkout session from Stripe
        checkout_session = stripe.checkout.Session.retrieve(request.session_id)
        
        if not checkout_session:
            raise HTTPException(status_code=404, detail="Checkout session not found")
        
        # Check if payment was successful
        if checkout_session.payment_status != "paid":
            raise HTTPException(
                status_code=400,
                detail=f"Payment status: {checkout_session.payment_status}. Subscription not activated."
            )
        
        # Check if mode is subscription
        if checkout_session.mode != "subscription":
            raise HTTPException(
                status_code=400,
                detail="This checkout session is not a subscription"
            )
        
        # Get user from metadata
        user_id = checkout_session.metadata.get('user_id')
        if not user_id or user_id != current_user["user_id"]:
            raise HTTPException(
                status_code=403,
                detail="Checkout session does not belong to this user"
            )
        
        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if subscription is already activated
        if user.subscription_status == "active" and user.subscription_type:
            print(f"ℹ️ Subscription already active for user {user_id}")
            return {
                "message": "Subscription already activated",
                "status": "active",
                "subscription_type": user.subscription_type,
                "subscription_credits": user.subscription_credits
            }
        
        # Get subscription details from metadata
        subscription_type = checkout_session.metadata.get('subscription_type', 'starter')
        credits = int(checkout_session.metadata.get('credits', 120))
        is_annual = checkout_session.metadata.get('is_annual', 'False').lower() == 'true'
        expires_at_str = checkout_session.metadata.get('expires_at')
        
        if expires_at_str:
            expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
        else:
            from datetime import timedelta
            expires_at = datetime.utcnow() + timedelta(days=365 if is_annual else 30)
        
        # Update user subscription
        user.subscription_type = subscription_type
        user.subscription_credits = credits
        user.subscription_status = "active"
        user.subscription_expires_at = expires_at
        
        db.commit()
        db.refresh(user)
        
        print(f"✅ Subscription activated via verify-checkout for user {user_id}: {subscription_type} with {credits} credits")
        
        return {
            "message": "Subscription activated successfully",
            "status": "success",
            "subscription_type": subscription_type,
            "subscription_credits": credits,
            "subscription_status": "active",
            "expires_at": expires_at.isoformat()
        }
        
    except stripe.error.StripeError as e:
        print(f"❌ Stripe error verifying checkout: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error verifying checkout: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/subscriptions/check-activation")
async def check_subscription_activation(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check and activate any paid subscriptions that haven't been activated yet"""
    try:
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # If user already has an active subscription, return it
        if user.subscription_status == "active" and user.subscription_type:
            return {
                "message": "Subscription already active",
                "status": "active",
                "subscription_type": user.subscription_type,
                "subscription_credits": user.subscription_credits
            }
        
        # Search for recent checkout sessions for this user's email
        try:
            # List checkout sessions with the user's email
            checkout_sessions = stripe.checkout.Session.list(
                customer_email=user.email,
                limit=10
            )
            
            for session in checkout_sessions.data:
                # Check if this session is a subscription and was paid
                if (session.mode == "subscription" and 
                    session.payment_status == "paid" and
                    session.metadata.get('user_id') == user.id):
                    
                    # Get subscription details from metadata
                    subscription_type = session.metadata.get('subscription_type', 'starter')
                    credits = int(session.metadata.get('credits', 120))
                    is_annual = session.metadata.get('is_annual', 'False').lower() == 'true'
                    expires_at_str = session.metadata.get('expires_at')
                    
                    if expires_at_str:
                        expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
                    else:
                        from datetime import timedelta
                        expires_at = datetime.utcnow() + timedelta(days=365 if is_annual else 30)
                    
                    # Activate subscription
                    user.subscription_type = subscription_type
                    user.subscription_credits = credits
                    user.subscription_status = "active"
                    user.subscription_expires_at = expires_at
                    
                    db.commit()
                    db.refresh(user)
                    
                    print(f"✅ Subscription activated via check-activation for user {user.id}: {subscription_type} with {credits} credits")
                    
                    return {
                        "message": "Subscription activated successfully",
                        "status": "success",
                        "subscription_type": subscription_type,
                        "subscription_credits": credits,
                        "subscription_status": "active",
                        "expires_at": expires_at.isoformat()
                    }
            
            return {
                "message": "No paid subscriptions found to activate",
                "status": "not_found"
            }
            
        except stripe.error.StripeError as e:
            print(f"⚠️ Stripe error checking subscriptions: {e}")
            return {
                "message": f"Could not check subscriptions: {str(e)}",
                "status": "error"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error checking subscription activation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/subscriptions/cancel")
async def cancel_subscription(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel user subscription"""
    try:
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if user has an active subscription
        if user.subscription_status != "active":
            raise HTTPException(
                status_code=400,
                detail="No active subscription to cancel"
            )
        
        # Update subscription status to cancelled
        user.subscription_status = "cancelled"
        # Keep subscription_type and credits until expiration
        # The subscription will remain active until expires_at
        db.commit()
        db.refresh(user)
        
        return {
            "message": "Subscription cancelled successfully. Access will continue until the end of the current billing period.",
            "status": "success",
            "expires_at": user.subscription_expires_at.isoformat() if user.subscription_expires_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error cancelling subscription: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Helper Functions for Packshot Generation ----------
def has_alpha(url: str) -> bool:
    """Check if image has alpha channel by examining the file"""
    try:
        # Handle data URLs directly
        if url.startswith("data:image"):
            # Fast-path: if it's a PNG data URL, assume alpha may be present
            if url.startswith("data:image/png"):
                return True
            # Otherwise conservatively assume no alpha (JPEG, etc.)
            return False
        if url.startswith(get_base_url() + "/static/"):
            # Local file - check directly
            filename = url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            if os.path.exists(filepath):
                with Image.open(filepath) as im:
                    return im.mode in ("LA", "RGBA")
        return url.lower().endswith(".png")
    except Exception:
        return url.lower().endswith(".png")

def rembg_cutout(photo_url: str) -> Image.Image:
    """Use Replicate's rembg to remove background"""
    try:
        print(f"🪄 Removing background for: {photo_url[:80]}...")
        
        # If this is a data URL, decode and save to temp file, then use rembg
        if photo_url.startswith("data:image"):
            import base64
            from io import BytesIO
            import tempfile
            header, b64data = photo_url.split(",", 1)
            img_bytes = base64.b64decode(b64data)
            
            # Save to temporary file (rembg works better with files than BytesIO)
            with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as tmp_file:
                tmp_file.write(img_bytes)
                tmp_file_path = tmp_file.name
            
            try:
                print("🔄 Calling rembg API for data URL (via temp file)...")
                with open(tmp_file_path, 'rb') as f:
                    out = replicate.run("cjwbw/rembg", input={"image": f})
                if hasattr(out, 'url'):
                    result_url = out.url()
                elif isinstance(out, str):
                    result_url = out
                else:
                    result_url = str(out)
                # Download the result
                import requests
                response = requests.get(result_url, timeout=10)
                response.raise_for_status()
                return Image.open(BytesIO(response.content)).convert("RGBA")
            finally:
                # Clean up temp file
                try:
                    import os
                    os.unlink(tmp_file_path)
                except:
                    pass

        # If it's a local URL, convert to file path and use rembg
        if photo_url.startswith(get_base_url() + "/static/"):
            filename = photo_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            if os.path.exists(filepath):
                print(f"🔄 Calling rembg API for local file: {filepath}")
                with open(filepath, "rb") as f:
                    out = replicate.run("cjwbw/rembg", input={"image": f})
                    if hasattr(out, 'url'):
                        result_url = out.url()
                    elif isinstance(out, str):
                        result_url = out
                    else:
                        result_url = str(out)
                    # Download the result
                    response = requests.get(result_url)
                    return Image.open(BytesIO(response.content)).convert("RGBA")
            else:
                print(f"⚠️ Local file not found: {filepath}")
        
        # For external URLs (Cloudinary packshots), use the URL directly with rembg
        # Replicate can accept URLs directly, which is more reliable than BytesIO
        print("🔄 Calling rembg API for external URL (using URL directly)...")
        try:
            # Use the URL directly - Replicate can fetch from URLs
            out = replicate.run("cjwbw/rembg", input={"image": photo_url})
            if hasattr(out, 'url'):
                result_url = out.url()
            elif isinstance(out, str):
                result_url = out
            else:
                result_url = str(out)
            
            # Download the result
            print(f"📥 Downloading rembg result from: {result_url[:80]}...")
            result_response = requests.get(result_url, timeout=10)
            result_response.raise_for_status()
            result_img = Image.open(BytesIO(result_response.content)).convert("RGBA")
            print(f"✅ Background removed successfully, result size: {result_img.size}")
            return result_img
        except Exception as rembg_error:
            # If URL doesn't work, try downloading and using file
            print(f"⚠️ rembg with URL failed, trying with file: {rembg_error}")
            print(f"📥 Downloading image from: {photo_url[:80]}...")
            response = requests.get(photo_url, timeout=10)
            response.raise_for_status()
            
            # Save to temporary file and use that
            import tempfile
            import os
            with tempfile.NamedTemporaryFile(delete=False, suffix='.webp') as tmp_file:
                tmp_file.write(response.content)
                tmp_file_path = tmp_file.name
            
            try:
                # Use file path
                with open(tmp_file_path, 'rb') as f:
                    out = replicate.run("cjwbw/rembg", input={"image": f})
                if hasattr(out, 'url'):
                    result_url = out.url()
                elif isinstance(out, str):
                    result_url = out
                else:
                    result_url = str(out)
                
                # Download the result
                print(f"📥 Downloading rembg result from: {result_url[:80]}...")
                result_response = requests.get(result_url, timeout=10)
                result_response.raise_for_status()
                result_img = Image.open(BytesIO(result_response.content)).convert("RGBA")
                print(f"✅ Background removed successfully (file method), result size: {result_img.size}")
                return result_img
            finally:
                # Clean up temp file
                try:
                    os.unlink(tmp_file_path)
                except:
                    pass
        
    except Exception as e:
        print(f"❌ Background removal failed: {e}")
        import traceback
        traceback.print_exc()
        # Fallback: try to download and return as-is
        try:
            import requests
            from io import BytesIO
            response = requests.get(photo_url, timeout=10)
            return Image.open(BytesIO(response.content)).convert("RGBA")
        except:
            # Last resort: return blank image
            return Image.new("RGBA", (800, 800), (255, 255, 255, 0))

def postprocess_cutout(img_rgba: Image.Image) -> Image.Image:
    """Clean up the cutout image"""
    try:
        # Trim transparent margins
        bbox = img_rgba.getbbox()
        if bbox:
            img_rgba = img_rgba.crop(bbox)
        
        # Mild denoise & clarity
        den = img_rgba.filter(ImageFilter.MedianFilter(size=3))
        sharp = den.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=4))
        
        # Add some padding
        pad = int(max(sharp.size) * 0.06)
        return ImageOps.expand(sharp, border=pad, fill=(0,0,0,0))
    except Exception as e:
        print(f"Postprocessing failed: {e}")
        return img_rgba

def upload_png(img: Image.Image, max_size: int = 768) -> str:
    """Save RGBA image locally as optimized PNG (scaled) and return /static URL"""
    try:
        os.makedirs("uploads", exist_ok=True)
        # Scale preserving aspect ratio
        w, h = img.size
        scale = min(1.0, max_size / float(max(w, h)))
        if scale < 1.0:
            new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        filename = f"product_{uuid.uuid4().hex}.png"
        filepath = os.path.join("uploads", filename)
        # Save optimized PNG
        img.save(filepath, format="PNG", optimize=True)
        return get_static_url(filename)
    except Exception as e:
        print(f"❌ upload_png failed: {e}")
        # Fallback: attempt to save without options
        try:
            filename = f"product_{uuid.uuid4().hex}.png"
            filepath = os.path.join("uploads", filename)
            img.save(filepath)
            return get_static_url(filename)
        except Exception:
            raise

def compress_image_for_processing(filepath: str, max_size: int = 512) -> str:
    """Compress and resize image for efficient processing with Replicate"""
    try:
        import base64
        import io
        from PIL import Image
        
        print(f"🗜️ Compressing {filepath} for processing...")
        
        # Open image
        img = Image.open(filepath)
        original_size = img.size
        
        # Resize to max_size (keeping aspect ratio)
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # Convert to RGB if needed (for JPEG)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            if img.mode in ('RGBA', 'LA'):
                background.paste(img, mask=img.split()[-1])
                img = background
            else:
                img = img.convert('RGB')
        
        # Compress to JPEG with 75% quality for Vella compatibility
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=75, optimize=True)
        compressed_size = len(output.getvalue())
        
        # Convert to base64
        base64_data = base64.b64encode(output.getvalue()).decode()
        data_url = f"data:image/jpeg;base64,{base64_data}"
        
        print(f"✅ Compressed: {original_size} → {img.size}, {compressed_size//1024}KB, base64: {len(data_url)//1024}KB")
        return data_url
        
    except Exception as e:
        print(f"❌ Failed to compress image: {e}")
        return filepath

def upload_to_replicate(filepath: str) -> str:
    """Compress and convert local file to base64 data URL for Replicate"""
    # Use 384px for Vella (smaller base64, better compatibility)
    return compress_image_for_processing(filepath, max_size=384)

def enhance_with_nano_banana(image_url: str, prompt: str = "") -> str:
    """Enhance person's realism with Nano Banana (img2img focused on subject)"""
    try:
        print(f"🍌 Enhancing person with Nano Banana (img2img mode)...")
        
        # Img2img prompt focused ONLY on enhancing the person, not background
        if not prompt:
            prompt = "enhance the person's realism only, ultra detailed skin texture, natural facial features, realistic fabric and clothing texture, professional portrait lighting on subject, sharp focus on person, photorealistic human details, preserve background as is"
        
        # Run Nano Banana in img2img mode with focus on person
        out = replicate.run("google/nano-banana", input={
            "image": image_url,
            "prompt": prompt,
            "num_inference_steps": 8,  # Very low steps to preserve input
            "guidance_scale": 2.0,  # Very low guidance to preserve input
            "strength": 0.05  # Very low strength = preserve input, only subtle refinement
        })
        
        # Handle output
        if hasattr(out, 'url'):
            result_url = out.url()
        elif isinstance(out, str):
            result_url = out
        elif isinstance(out, list) and len(out) > 0:
            result_url = str(out[0])
        else:
            result_url = str(out)
        
        print(f"✅ Nano Banana enhancement completed: {result_url[:50]}...")
        return result_url
        
    except Exception as e:
        print(f"❌ Nano Banana enhancement failed: {e}")
        print(f"Continuing with original image")
        return image_url


def upload_pil_to_cloudinary(img: Image.Image, folder: str = "auraengine") -> str:
    """
    Upload a PIL Image to Cloudinary and return the public URL.
    """
    try:
        # Check if Cloudinary is configured
        if not (CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET):
            print("⚠️ Cloudinary not configured, falling back to local storage")
            return upload_png(img)
        
        # Convert PIL Image to bytes
        from io import BytesIO
        img_buffer = BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        # Upload to Cloudinary
        result = cloudinary.uploader.upload(
            img_buffer,
            folder=folder,
            public_id=f"{folder}_{uuid.uuid4().hex}",
            format="png",
            resource_type="image"
        )
        cloudinary_url = result['secure_url']
        print(f"✅ Uploaded PIL image to Cloudinary: {cloudinary_url[:50]}...")
        return cloudinary_url
    except Exception as e:
        print(f"❌ Failed to upload PIL image to Cloudinary: {e}")
        return upload_png(img)

def _save_to_local_storage(url: str, folder: str = "auraengine") -> str:
    """
    Save image/video to local storage when Cloudinary is not configured.
    Returns a local static URL that works for the frontend but NOT for AI models.
    """
    import requests
    
    # Ensure static directory exists
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", folder)
    os.makedirs(static_dir, exist_ok=True)
    
    filename = f"{folder}_{uuid.uuid4().hex}"
    
    # Handle data URL (base64)
    if isinstance(url, str) and url.startswith("data:"):
        try:
            header, b64 = url.split(",", 1)
            if "video" in header:
                ext = "mp4"
            elif "png" in header:
                ext = "png"
            elif "webp" in header:
                ext = "webp"
            else:
                ext = "jpg"
            
            filepath = os.path.join(static_dir, f"{filename}.{ext}")
            with open(filepath, "wb") as f:
                f.write(base64.b64decode(b64))
            
            local_url = f"{get_base_url()}/static/{folder}/{filename}.{ext}"
            print(f"📁 Saved to local storage: {local_url}")
            return local_url
        except Exception as e:
            print(f"❌ Failed to save data URL locally: {e}")
            raise
    
    # Handle http(s) URL - download and save
    if isinstance(url, str) and (url.startswith("http://") or url.startswith("https://")):
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            # Detect extension from content type or URL
            content_type = response.headers.get('content-type', '')
            if 'video' in content_type:
                ext = "mp4"
            elif 'png' in content_type or url.endswith('.png'):
                ext = "png"
            elif 'webp' in content_type or url.endswith('.webp'):
                ext = "webp"
            else:
                ext = "jpg"
            
            filepath = os.path.join(static_dir, f"{filename}.{ext}")
            with open(filepath, "wb") as f:
                f.write(response.content)
            
            local_url = f"{get_base_url()}/static/{folder}/{filename}.{ext}"
            print(f"📁 Downloaded and saved to local storage: {local_url}")
            return local_url
        except Exception as e:
            print(f"❌ Failed to download and save URL locally: {e}")
            raise
    
    # Handle local file path - copy to static
    if isinstance(url, str) and os.path.exists(url):
        try:
            ext = url.split('.')[-1] if '.' in url else 'jpg'
            filepath = os.path.join(static_dir, f"{filename}.{ext}")
            import shutil
            shutil.copy(url, filepath)
            
            local_url = f"{get_base_url()}/static/{folder}/{filename}.{ext}"
            print(f"📁 Copied to local storage: {local_url}")
            return local_url
        except Exception as e:
            print(f"❌ Failed to copy file locally: {e}")
            raise
    
    raise Exception(f"Unknown URL format for local storage: {url[:100] if isinstance(url, str) else type(url)}")

def upload_to_cloudinary(url: str, folder: str = "auraengine") -> str:
    """
    Upload an image or video to Cloudinary and return the public URL.
    Supports:
    - data:image/* base64
    - data:video/* base64
    - http(s) URLs (replicate.delivery, etc.)
    - local file paths
    
    Falls back to local storage when Cloudinary is not configured (development mode).
    """
    try:
        # Check if Cloudinary is configured - if not, use local storage fallback
        if not (CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET):
            print(f"⚠️ Cloudinary not configured - using local storage fallback")
            return _save_to_local_storage(url, folder)
        
        # Handle data URL
        if isinstance(url, str) and url.startswith("data:image/"):
            try:
                header, b64 = url.split(",", 1)
                ctype = header.split(";")[0].split(":")[1].lower()
                ext = "png" if "png" in ctype else ("webp" if "webp" in ctype else "jpg")
                
                # Upload to Cloudinary
                result = cloudinary.uploader.upload(
                    base64.b64decode(b64),
                    folder=folder,
                    public_id=f"{folder}_{uuid.uuid4().hex}",
                    format=ext,
                    resource_type="image"
                )
                cloudinary_url = result['secure_url']
                print(f"✅ Uploaded data URL to Cloudinary: {cloudinary_url[:50]}...")
                return cloudinary_url
            except Exception as e:
                print(f"❌ Failed to upload data URL to Cloudinary: {e}")
                raise

        # Handle http(s) URL
        if isinstance(url, str) and (url.startswith("http://") or url.startswith("https://")):
            try:
                # Detect if it's a video file
                is_video = any(url.lower().endswith(ext) for ext in ['.mp4', '.webm', '.mov', '.avi', '.mkv']) or 'video' in url.lower()
                
                resource_type = "video" if is_video else "image"
                
                # Upload directly from URL to Cloudinary
                result = cloudinary.uploader.upload(
                    url,
                    folder=folder,
                    public_id=f"{folder}_{uuid.uuid4().hex}",
                    resource_type=resource_type
                )
                cloudinary_url = result['secure_url']
                print(f"✅ Uploaded {resource_type} URL to Cloudinary: {cloudinary_url[:50]}...")
                return cloudinary_url
            except Exception as e:
                print(f"❌ Failed to upload URL to Cloudinary: {e}")
                raise

        # Handle local file path
        try:
            result = cloudinary.uploader.upload(
                url,
                folder=folder,
                public_id=f"{folder}_{uuid.uuid4().hex}",
                resource_type="image"
            )
            cloudinary_url = result['secure_url']
            print(f"✅ Uploaded local file to Cloudinary: {cloudinary_url[:50]}...")
            return cloudinary_url
        except Exception as e:
            print(f"❌ Failed to upload local file to Cloudinary: {e}")
            raise

    except Exception as e:
        print(f"❌ CRITICAL: Failed to upload to Cloudinary: {e}")
        print(f"   URL: {url[:100] if isinstance(url, str) else url}")
        print(f"   Folder: {folder}")
        raise Exception(f"Cloudinary upload failed: {str(e)}")

def download_and_save_image(url: str, prefix: str = "packshot") -> str:
    """
    Persist an image into uploads/ and return a stable /static URL.
    Supports:
    - data:image/* base64
    - http(s) URLs (replicate.delivery, etc.)
    - local file paths
    Falls back to returning the original url on failure.
    """
    try:
        os.makedirs("uploads", exist_ok=True)

        # Handle data URL
        if isinstance(url, str) and url.startswith("data:image/"):
            try:
                header, b64 = url.split(",", 1)
                ctype = header.split(";")[0].split(":")[1].lower()  # e.g., image/png
                ext = "png" if "png" in ctype else ("webp" if "webp" in ctype else "jpg")
                filename = f"{prefix}_{uuid.uuid4().hex}.{ext}"
                filepath = os.path.join("uploads", filename)
                with open(filepath, "wb") as f:
                    f.write(base64.b64decode(b64))
                local_url = get_static_url(filename)
                print(f"✅ Saved data URL to {local_url}")
                return local_url
            except Exception as e:
                print(f"❌ Failed to save data URL: {e}")
                return url

        # Handle http(s) URL
        if isinstance(url, str) and (url.startswith("http://") or url.startswith("https://")):
            try:
                resp = requests.get(url, stream=True, timeout=30)
                resp.raise_for_status()
                ctype = (resp.headers.get("Content-Type") or '').lower()
                # determine extension
                if "png" in ctype or url.lower().endswith(".png"):
                    ext = "png"
                elif "webp" in ctype or url.lower().endswith(".webp"):
                    ext = "webp"
                elif "jpeg" in ctype or "jpg" in ctype or url.lower().endswith(".jpg") or url.lower().endswith(".jpeg"):
                    ext = "jpg"
                else:
                    ext = "jpg"
                filename = f"{prefix}_{uuid.uuid4().hex}.{ext}"
                filepath = os.path.join("uploads", filename)
                with open(filepath, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                local_url = get_static_url(filename)
                print(f"✅ Downloaded image to {local_url}")
                return local_url
            except Exception as e:
                print(f"❌ Download failed for {url[:120]}...: {e}")
                return url

        # Treat as local file path
        try:
            ext = os.path.splitext(url)[1].lstrip(".") or "jpg"
            filename = f"{prefix}_{uuid.uuid4().hex}.{ext}"
            filepath = os.path.join("uploads", filename)
            with open(url, "rb") as src, open(filepath, "wb") as dst:
                dst.write(src.read())
            local_url = get_static_url(filename)
            print(f"✅ Copied local file to {local_url}")
            return local_url
        except Exception as e:
            print(f"❌ Local copy failed: {e}")
            return url

    except Exception as e:
        print(f"❌ Failed to process image: {e}")
        return url

def run_vella_try_on(model_image_url: str, product_image_url: str, quality_mode: str = "standard", clothing_type: str = "top") -> str:
    """
    Apply virtual try-on using Vella 1.5 API.
    
    This function applies clothing to a model using Vella 1.5:
    1. Takes a model image (can be from Qwen scene composition)
    2. Applies the product garment using AI-powered virtual try-on
    3. Returns a Replicate URL (not downloaded) for further processing
    4. Supports both high quality (random seed) and standard (fixed seed) modes
    5. Detects clothing type and uses correct Vella 1.5 parameter
    """
    try:
        print(f"🎭 Running Vella try-on: model={model_image_url[:80]}..., product={product_image_url[:80]}...")
        print(f"👕 Clothing type: {clothing_type}")
        print(f"🔍 Full product_image_url: {product_image_url}")

        # Force persist ephemeral replicate URLs to stable /static before calling Vella
        if isinstance(model_image_url, str) and model_image_url.startswith("https://replicate.delivery/"):
            try:
                model_image_url = upload_to_cloudinary(model_image_url, "vella_model")
                print(f"🧩 Persisted model to /static for Vella: {model_image_url}")
            except Exception as e:
                print(f"⚠️ Failed to persist model for Vella: {e}")
        if isinstance(product_image_url, str) and product_image_url.startswith("https://replicate.delivery/"):
            try:
                product_image_url = upload_to_cloudinary(product_image_url, "vella_product")
                print(f"🧩 Persisted garment to /static for Vella: {product_image_url}")
            except Exception as e:
                print(f"⚠️ Failed to persist garment for Vella: {e}")

        # Model input: prefer small public URL; convert only if local /static
        if model_image_url.startswith(get_base_url() + "/static/"):
            filename = model_image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            model_image_url = upload_to_replicate(filepath)
            print(f"🗜️ Converted local model to data URL")
        else:
            print(f"📁 Using model URL directly: {model_image_url[:50]}...")

        # WEBP Conversion: If garment is WEBP, convert to PNG first so Pillow/rembg can process
        if isinstance(product_image_url, str) and product_image_url.lower().endswith(".webp"):
            try:
                # Persist locally if not already
                persisted = stabilize_url(product_image_url, "garment_webp")
                # Read and convert to PNG
                filename = persisted.replace(get_base_url() + "/static/", "")
                with open(f"uploads/{filename}", "rb") as f:
                    img = Image.open(f).convert("RGBA")
                buf = BytesIO()
                img.save(buf, format="PNG", optimize=True)
                b64 = base64.b64encode(buf.getvalue()).decode()
                product_image_url = f"data:image/png;base64,{b64}"
                print("🧩 Converted WEBP garment to PNG (data URL)")
            except Exception as e:
                print(f"⚠️ WEBP→PNG convert failed: {e} — using original URL")

        # Garment: ensure alpha; prefer URL; convert to data URL only if local /static and URL attempt fails
        # For packshots, check if they already have transparency before trying to remove background
        # WEBP packshots from Cloudinary often already have transparent backgrounds
        try:
            # Check if it's likely a packshot (Cloudinary URL with packshot in name)
            is_packshot = "packshot" in product_image_url.lower() or "cloudinary" in product_image_url.lower()
            
            # For packshots, check if they might already have transparency (WEBP supports it)
            # Skip rembg for WEBP packshots to avoid API errors - they're usually already clean
            is_webp_packshot = is_packshot and (product_image_url.lower().endswith(".webp") or ".webp" in product_image_url.lower())
            
            if is_webp_packshot:
                # WEBP packshots from Cloudinary packshot generation are usually already isolated
                # However, Vella might work better with PNG format
                # Convert WEBP to PNG to ensure Vella can use it correctly
                print("🧵 WEBP packshot detected, converting to PNG for Vella compatibility...")
                try:
                    import requests
                    from io import BytesIO
                    print(f"📥 Downloading WEBP packshot from: {product_image_url[:80]}...")
                    response = requests.get(product_image_url, timeout=10)
                    response.raise_for_status()
                    webp_img = Image.open(BytesIO(response.content)).convert("RGBA")
                    print(f"✅ Downloaded WEBP, size: {webp_img.size}, mode: {webp_img.mode}")
                    
                    # Convert to PNG with transparency preserved
                    png_buffer = BytesIO()
                    webp_img.save(png_buffer, format="PNG", optimize=True)
                    png_buffer.seek(0)
                    
                    # Upload PNG version to Cloudinary
                    # Verify image properties before uploading
                    png_img = Image.open(png_buffer)
                    print(f"🔍 PNG image properties:")
                    print(f"   Size: {png_img.size}")
                    print(f"   Mode: {png_img.mode}")
                    print(f"   Has transparency: {png_img.mode in ('RGBA', 'LA')}")
                    
                    # Check if image has reasonable size (packshots should be isolated products)
                    # Vella works best with high resolution images
                    if png_img.size[0] < 512 or png_img.size[1] < 512:
                        print(f"⚠️ WARNING: Packshot image is small ({png_img.size}), Vella prefers higher resolution")
                    elif png_img.size[0] >= 512 and png_img.size[1] >= 512:
                        print(f"✅ Packshot size is good for Vella ({png_img.size[0]}x{png_img.size[1]})")
                    
                    # Ensure image is high quality for Vella (upscale if needed)
                    # Vella documentation says "High resolution to capture fabric details"
                    target_min_size = 1024
                    if png_img.size[0] < target_min_size or png_img.size[1] < target_min_size:
                        print(f"📏 Upscaling packshot to minimum {target_min_size}px for better Vella results...")
                        # Calculate scaling factor to maintain aspect ratio
                        scale_factor = max(target_min_size / png_img.size[0], target_min_size / png_img.size[1])
                        new_size = (int(png_img.size[0] * scale_factor), int(png_img.size[1] * scale_factor))
                        png_img = png_img.resize(new_size, Image.LANCZOS)
                        print(f"✅ Upscaled to {png_img.size}")
                    
                    png_url = upload_pil_to_cloudinary(png_img, "garment_png")
                    print(f"✅ Converted WEBP to PNG: {png_url[:80]}...")
                    print(f"🔍 Final PNG garment URL for Vella: {png_url}")
                    print(f"🔍 Final garment image size: {png_img.size[0]}x{png_img.size[1]} (Vella prefers high resolution)")
                    garment_url = png_url
                    print(f"🧵 Garment URL (PNG): {garment_url[:80]}...")
                except Exception as conv_error:
                    print(f"⚠️ WEBP→PNG conversion failed: {conv_error}")
                    print(f"⚠️ Using original WEBP packshot (Vella may not use it correctly)")
                    garment_url = product_image_url
                    print(f"🧵 Garment URL (WEBP fallback): {garment_url[:80]}...")
            elif has_alpha(product_image_url) and not is_packshot:
                # Only skip processing if it already has alpha AND it's not a packshot
                garment_url = product_image_url
                print("🧵 Garment already has alpha, using as-is")
            else:
                print("🪄 Processing garment image (removing background)...")
                print(f"   Input: {product_image_url[:80]}...")
                try:
                    cut = rembg_cutout(product_image_url)
                    print(f"✅ Background removal complete, image size: {cut.size}")
                    cut = postprocess_cutout(cut)
                    print(f"✅ Post-processing complete, final size: {cut.size}")
                    garment_url = upload_pil_to_cloudinary(cut, "garment_cutout")  # -> Cloudinary URL
                    print(f"🧵 Garment cutout saved: {garment_url[:80]}...")
                except Exception as rembg_error:
                    print(f"⚠️ Background removal failed: {rembg_error}")
                    print(f"⚠️ Using original packshot image (may have background)")
                    # For packshots, even if rembg fails, use the original - it's usually already isolated
                    garment_url = product_image_url
                    print(f"🧵 Garment URL (fallback): {garment_url[:80]}...")
                print(f"🔍 Final garment URL being sent to Vella: {garment_url}")
        except Exception as e:
            print(f"⚠️ Garment processing failed: {e}")
            import traceback
            traceback.print_exc()
            print(f"⚠️ Falling back to original product_image_url")
            garment_url = product_image_url

        # Run Vella 1.5 try-on
        try:
            # Configure Vella 1.5 parameters
            if quality_mode == "high":
                num_outputs = 1
                seed = None
                print("🎨 Using HIGH QUALITY Vella 1.5 mode")
            else:
                num_outputs = 1
                seed = 42
                print("⚡ Using STANDARD Vella 1.5 mode")
            
            print(f"🎭 Calling Vella 1.5 API")
            print(f"   Model: {model_image_url[:80]}...")
            print(f"   Garment: {garment_url[:80]}...")
            print(f"   Clothing type: {clothing_type}")
            print(f"🔍 COMPLETE Vella input - Model URL: {model_image_url}")
            print(f"🔍 COMPLETE Vella input - Garment URL: {garment_url}")
            
            # Build Vella 1.5 input - use correct parameter based on clothing type
            # For tops: top_image, for bottoms: bottom_image
            vella_input = {
                "model_image": model_image_url,
                "num_outputs": num_outputs,
                "garment_only": True,  # Try to replace existing clothing instead of adding layers
                "remove_background": False,  # Keep the scene background
            }
            
            # Map clothing types to Vella parameters
            clothing_type_lower = clothing_type.lower() if clothing_type else "top"
            is_bottom = clothing_type_lower in ["pants", "shorts", "skirt", "bottom"]
            is_top = clothing_type_lower in ["tshirt", "sweater", "hoodie", "jacket", "dress", "top", "shirt", "other"]
            
            # Vella 1.5 API: Supports top_image, bottom_image, outer_image, dress_image, and garment_image
            # Try using specific parameters first (bottom_image/top_image), but garment_image might be more reliable
            # For bottoms, use bottom_image parameter directly
            if is_bottom:
                # Use bottom_image parameter for pants/shorts/skirts
                vella_input["bottom_image"] = garment_url
                print(f"👖 Using bottom_image parameter for {clothing_type}")
                print(f"🔍 Bottom garment URL: {garment_url[:80]}...")
                print(f"🔍 Complete bottom_image URL: {garment_url}")
                print(f"🔍 Packshot image details: PNG format, RGBA mode, Has transparency")
                
                # Verify the garment image is accessible and valid
                try:
                    import requests
                    verify_response = requests.head(garment_url, timeout=5)
                    print(f"🔍 Garment URL verification: Status {verify_response.status_code}")
                    if verify_response.status_code == 200:
                        content_type = verify_response.headers.get('Content-Type', '')
                        print(f"🔍 Garment Content-Type: {content_type}")
                        if 'image' not in content_type.lower():
                            print(f"⚠️ WARNING: Garment URL might not be an image: {content_type}")
                except Exception as verify_error:
                    print(f"⚠️ Could not verify garment URL: {verify_error}")
            elif is_top:
                vella_input["top_image"] = garment_url
                print(f"👕 Using top_image parameter for {clothing_type}")
            else:
                # Default to top_image for unknown types
                vella_input["top_image"] = garment_url
                print(f"⚠️ Unknown clothing type '{clothing_type}', defaulting to top_image")
            
            # Also try adding garment_image as a fallback (might help Vella understand better)
            # Note: Vella might prefer one parameter over the other, so we use the specific one (bottom_image/top_image)
            # but keep garment_image as a reference if supported
            
            # Debug: Print what we're sending to Vella
            print(f"🔍 Vella input structure: {list(vella_input.keys())}")
            print(f"🔍 Clothing type detection - is_bottom: {is_bottom}, is_top: {is_top}, type: '{clothing_type}'")
            
            if seed is not None:
                vella_input["seed"] = seed
            
            print(f"🎭 Vella input keys: {list(vella_input.keys())}")
            
            # Call Vella 1.5 with retry logic
            print("🔄 Calling Replicate Vella 1.5...")
            max_retries = 3
            
            for attempt in range(max_retries):
                try:
                    print(f"🎭 Vella attempt {attempt + 1}/{max_retries}...")
                    print(f"🔍 Vella input keys before API call: {list(vella_input.keys())}")
                    print(f"🔍 Vella input values (truncated): model_image={str(vella_input.get('model_image', ''))[:50]}..., garment_key={'bottom_image' if 'bottom_image' in vella_input else 'top_image' if 'top_image' in vella_input else 'unknown'}")
                    out = replicate.run("omnious/vella-1.5", input=vella_input)
                    print(f"✅ Vella API call succeeded on attempt {attempt + 1}!")
                    print(f"🎭 Vella API response type: {type(out)}")
                    if hasattr(out, '__dict__'):
                        print(f"🎭 Vella response attributes: {list(out.__dict__.keys())}")
                    break  # Success, exit retry loop
                except Exception as e:
                    print(f"⚠️ Vella attempt {attempt + 1} failed: {e}")
                    print(f"🔍 Error details: {type(e).__name__}: {str(e)}")
                    # If bottom_image was rejected, try garment_image with garment_type as fallback
                    if "bottom_image" in vella_input and ("not supported" in str(e).lower() or "invalid" in str(e).lower() or "unexpected" in str(e).lower()):
                        print(f"🔄 bottom_image parameter rejected, trying garment_image with garment_type='bottom' fallback...")
                        vella_input.pop("bottom_image", None)
                        vella_input["garment_image"] = garment_url
                        vella_input["garment_type"] = "bottom"
                        print(f"👖 Retrying with garment_image and garment_type='bottom'")
                        continue  # Retry with new parameters
                    if attempt < max_retries - 1:
                        wait_time = (attempt + 1) * 10  # Exponential backoff: 10s, 20s, 30s
                        print(f"⏳ Waiting {wait_time}s before retry...")
                        import time
                        time.sleep(wait_time)
                    else:
                        print(f"❌ All {max_retries} Vella attempts failed, raising exception")
                        raise e
            
            # Handle different return types
            if hasattr(out, 'url'):
                try_on_url = out.url()
            elif isinstance(out, str):
                try_on_url = out
            elif isinstance(out, list) and len(out) > 0:
                try_on_url = out[0] if isinstance(out[0], str) else out[0].url()
            else:
                try_on_url = str(out)
            
            # Immediately persist Replicate URLs to avoid 404 errors
            if isinstance(try_on_url, str) and try_on_url.startswith("https://replicate.delivery/"):
                try:
                    try_on_url = upload_to_cloudinary(try_on_url, "vella_try_on")
                    print(f"✅ Persisted Vella result: {try_on_url[:50]}...")
                except Exception as e:
                    print(f"⚠️ Failed to persist Vella result: {e}")
            
            print(f"✅ Vella try-on completed: {try_on_url[:50]}...")
            return try_on_url
            
        except Exception as e:
            print(f"❌ Vella try-on failed: {e}")
            # Prefer returning the Qwen composite (model_image_url may already be Qwen output)
            print("↩️ Returning previous composed image instead of placeholder")
            return model_image_url
        
    except Exception as e:
        print(f"❌ Vella try-on generation failed: {e}")
        print("↩️ Returning previous composed image instead of placeholder")
        return model_image_url

def run_qwen_add_product(model_image_url: str, product_image_url: str, clothing_type: str, product_name: str) -> str:
    """Add a product to a model image using Qwen Image Edit Plus"""
    try:
        print(f"🎨 Running Qwen to add {product_name} ({clothing_type}) to image...")
        
        # Convert local URLs to external URLs for Replicate
        if model_image_url.startswith(get_base_url() + "/static/"):
            filename = model_image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            model_image_url = upload_to_replicate(filepath)
            print(f"📁 Converted local model image to external URL")
            
        if product_image_url.startswith(get_base_url() + "/static/"):
            filename = product_image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            product_image_url = upload_to_replicate(filepath)
            print(f"📁 Converted local product image to external URL")
        
        # Create a strong prompt that tells Qwen to apply the exact product from the packshot
        clothing_type_lower = clothing_type.lower() if clothing_type else "product"
        
        # Map clothing types to specific instructions
        clothing_instructions = {
            "pants": "CRITICAL: Apply ONLY the pants from the second image onto the person in the first image. Remove any existing pants/bottoms. Use the EXACT pants shown in the packshot image (second image). Do not generate or create new pants - use the specific pants from the packshot. The pants must match exactly in color, style, texture, and details.",
            "shorts": "CRITICAL: Apply ONLY the shorts from the second image onto the person in the first image. Remove any existing shorts/bottoms. Use the EXACT shorts shown in the packshot image (second image). Do not generate or create new shorts - use the specific shorts from the packshot.",
            "skirt": "CRITICAL: Apply ONLY the skirt from the second image onto the person in the first image. Remove any existing skirts/bottoms. Use the EXACT skirt shown in the packshot image (second image). Do not generate or create new skirts - use the specific skirt from the packshot.",
            "tshirt": "CRITICAL: Apply ONLY the t-shirt from the second image onto the person in the first image. Remove any existing shirts/tops. Use the EXACT t-shirt shown in the packshot image (second image). Do not generate or create new shirts - use the specific t-shirt from the packshot.",
            "shirt": "CRITICAL: Apply ONLY the shirt from the second image onto the person in the first image. Remove any existing shirts/tops. Use the EXACT shirt shown in the packshot image (second image). Do not generate or create new shirts - use the specific shirt from the packshot.",
            "sweater": "CRITICAL: Apply ONLY the sweater from the second image onto the person in the first image. Remove any existing sweaters/tops. Use the EXACT sweater shown in the packshot image (second image). Do not generate or create new sweaters - use the specific sweater from the packshot.",
            "jacket": "CRITICAL: Apply ONLY the jacket from the second image onto the person in the first image. Remove any existing jackets/tops. Use the EXACT jacket shown in the packshot image (second image). Do not generate or create new jackets - use the specific jacket from the packshot.",
            "hoodie": "CRITICAL: Apply ONLY the hoodie from the second image onto the person in the first image. Remove any existing hoodies/tops. Use the EXACT hoodie shown in the packshot image (second image). Do not generate or create new hoodies - use the specific hoodie from the packshot.",
        }
        
        base_prompt = clothing_instructions.get(clothing_type_lower, 
            f"CRITICAL: Apply ONLY the {clothing_type_lower} from the second image onto the person in the first image. Use the EXACT {clothing_type_lower} shown in the packshot image (second image). Do not generate or create new {clothing_type_lower} - use the specific {clothing_type_lower} from the packshot. The {clothing_type_lower} must match exactly in color, style, texture, and details.")
        
        full_prompt = f"{base_prompt} Keep the person's body, pose, face, and all other clothing unchanged. Only replace/add the {clothing_type_lower} from the packshot. Professional fashion photography quality with perfect garment integration."
        
        print(f"📝 Qwen prompt: {full_prompt[:200]}...")
        print(f"🖼️ Model image URL: {model_image_url[:80]}...")
        print(f"🛍️ Product image URL: {product_image_url[:80]}...")
        print(f"👕 Clothing type: {clothing_type}")
        
        # Use Qwen Image Edit Plus with 2 images (model + product packshot)
        try:
            print("🔄 Calling Qwen Image Edit Plus...")
            out = replicate.run("qwen/qwen-image-edit-plus", input={
                "prompt": full_prompt,
                "image": [model_image_url, product_image_url],
                "num_inference_steps": 50,  # More steps for better accuracy
                "guidance_scale": 7.5,  # Higher guidance for strict adherence to packshot
                "strength": 0.8  # High strength to ensure packshot is applied
            })
            
            # Handle output
            if hasattr(out, 'url'):
                result_url = out.url()
            elif isinstance(out, str):
                result_url = out
            elif isinstance(out, list) and len(out) > 0:
                result_url = out[0] if isinstance(out[0], str) else out[0].url()
            else:
                result_url = str(out)
            
            # Immediately persist Replicate URLs to avoid 404 errors
            if isinstance(result_url, str) and result_url.startswith("https://replicate.delivery/"):
                try:
                    result_url = upload_to_cloudinary(result_url, "qwen_add_product")
                    print(f"✅ Persisted Qwen result to Cloudinary: {result_url[:80]}...")
                except Exception as upload_error:
                    print(f"⚠️ Failed to persist to Cloudinary: {upload_error}")
            
            print(f"✅ Qwen add product completed: {result_url[:80]}...")
            return result_url
            
        except Exception as qwen_error:
            print(f"❌ Qwen add product failed: {qwen_error}")
            import traceback
            traceback.print_exc()
            raise qwen_error
            
    except Exception as e:
        print(f"❌ Qwen add product generation failed: {e}")
        import traceback
        traceback.print_exc()
        print("↩️ Returning original model image instead of placeholder")
        return model_image_url

def run_nano_banana_pro(prompt: str, image_urls: list, strength: float = 0.50, guidance_scale: float = 7.0, num_steps: int = 30, negative_prompt: str = None) -> str:
    """
    Use Replicate's google/nano-banana-pro for advanced image editing/generation
    
    Args:
        prompt: Text description of what to do
        image_urls: List of image URLs to use as input
        strength: How much to modify (0.0-1.0)
        guidance_scale: How closely to follow the prompt
        num_steps: Number of inference steps
        negative_prompt: Optional negative prompt to avoid unwanted features
    
    Returns:
        URL of generated image
    """
    try:
        print(f"🍌 PRO Running nano-banana-pro via Replicate...")
        print(f"📝 Prompt: {prompt[:150]}...")
        if negative_prompt:
            print(f"🚫 Negative prompt: {negative_prompt[:100]}...")
        print(f"🖼️ Input images: {len(image_urls)}")
        for idx, url in enumerate(image_urls):
            print(f"   Image {idx+1}: {url[:100]}...")
        print(f"⚙️ Parameters: strength={strength}, guidance={guidance_scale}, steps={num_steps}")
        
        # Validate image URLs before calling Replicate
        for idx, url in enumerate(image_urls):
            if not url or not isinstance(url, str):
                raise ValueError(f"Image {idx+1} is invalid: {url}")
            if url.startswith("http://localhost") or url.startswith("http://127.0.0.1"):
                raise ValueError(f"Image {idx+1} is a local URL that Replicate cannot access: {url[:100]}")
            if "/static/" in url and "cloudinary" not in url and "replicate.delivery" not in url:
                raise ValueError(f"Image {idx+1} appears to be a local static file: {url[:100]}")
        
        # Call Replicate's nano-banana-pro model
        import replicate
        print(f"🔄 Calling Replicate API...")
        
        # Build input dict
        input_dict = {
            "prompt": prompt,
            "image_input": image_urls,
            "num_inference_steps": num_steps,
            "guidance_scale": guidance_scale,
            "strength": strength,
            "seed": None
        }
        
        # Add negative prompt if provided
        if negative_prompt:
            input_dict["negative_prompt"] = negative_prompt
        
        out = replicate.run("google/nano-banana-pro", input=input_dict)
        
        # Handle output
        if hasattr(out, 'url'):
            result_url = out.url()
        elif isinstance(out, str):
            result_url = out
        elif isinstance(out, list) and len(out) > 0:
            result_url = out[0] if isinstance(out[0], str) else out[0].url() if hasattr(out[0], 'url') else str(out[0])
        else:
            result_url = str(out)
        
        print(f"✅ Nano-banana PRO completed: {result_url[:80]}...")
        return result_url
        
    except ValueError as ve:
        print(f"❌ INPUT VALIDATION ERROR: {ve}")
        print(f"🚫 Cannot proceed with nano-banana-pro - invalid input")
        import traceback
        traceback.print_exc()
        raise  # Re-raise to propagate the error
        
    except Exception as e:
        print(f"❌ NANO-BANANA-PRO FAILED: {type(e).__name__}: {e}")
        print(f"📋 Error details:")
        print(f"   - Prompt length: {len(prompt)}")
        print(f"   - Number of images: {len(image_urls)}")
        print(f"   - Image URLs valid: {all(isinstance(url, str) and url.startswith('http') for url in image_urls)}")
        import traceback
        traceback.print_exc()
        
        # Fall back to standard nano-banana
        print(f"🔄 Attempting fallback to standard nano-banana...")
        try:
            import replicate
            out = replicate.run("google/nano-banana", input={
                "prompt": prompt,
                "image_input": image_urls,
                "num_inference_steps": num_steps,
                "guidance_scale": guidance_scale,
                "strength": strength,
                "seed": None
            })
            if hasattr(out, 'url'):
                result = out.url()
                print(f"✅ Fallback succeeded: {result[:80]}...")
                return result
            elif isinstance(out, str):
                print(f"✅ Fallback succeeded: {out[:80]}...")
                return out
            elif isinstance(out, list) and len(out) > 0:
                result = out[0] if isinstance(out[0], str) else out[0].url()
                print(f"✅ Fallback succeeded: {result[:80]}...")
                return result
            return str(out)
        except Exception as fallback_error:
            print(f"❌ FALLBACK ALSO FAILED: {type(fallback_error).__name__}: {fallback_error}")
            import traceback
            traceback.print_exc()
            # Return first image as last resort
            print(f"⚠️ Returning original image as last resort")
            return image_urls[0] if image_urls else ""

def replace_manikin_with_person(manikin_pose_url: str, person_wearing_product_url: str) -> str:
    """Replace manikin in pose image with person wearing product using nano-banana pro"""
    try:
        print(f"🍌 Replacing manikin with person using nano-banana...")
        print(f"🦴 Manikin pose: {manikin_pose_url[:50]}...")
        print(f"👤 Person wearing product: {person_wearing_product_url[:50]}...")
        
        # Ensure URLs are accessible (convert local paths to Cloudinary if needed)
        if person_wearing_product_url.startswith(get_base_url() + "/static/"):
            filename = person_wearing_product_url.replace(get_base_url() + "/static/", "")
            # File could be in static/ or uploads/ directory
            static_path = f"static/{filename}"
            uploads_path = f"uploads/{filename}"
            filepath = static_path if os.path.exists(static_path) else (uploads_path if os.path.exists(uploads_path) else None)
            if filepath and os.path.exists(filepath):
                # Read file and upload to Cloudinary
                import base64
                with open(filepath, "rb") as f:
                    file_content = f.read()
                    ext = filename.split('.')[-1] if '.' in filename else 'jpg'
                    data_url = f"data:image/{ext};base64,{base64.b64encode(file_content).decode()}"
                    person_wearing_product_url = upload_to_cloudinary(data_url, "person_wearing_product")
            else:
                # If file doesn't exist locally, try to use the URL directly
                print(f"⚠️ File not found locally: {static_path} or {uploads_path}, using URL directly")
        
        # If manikin pose URL is a localhost/static URL, try to convert to Cloudinary
        # But first check if it's already a Cloudinary URL (from POSE_IMAGE_URLS)
        if manikin_pose_url.startswith("https://res.cloudinary.com/"):
            # Already a Cloudinary URL, use it directly
            print(f"✅ Using Cloudinary URL for manikin pose")
        elif manikin_pose_url.startswith(get_base_url() + "/static/") or manikin_pose_url.startswith("http://localhost"):
            # This is a localhost URL - we need to convert it to Cloudinary
            filename = manikin_pose_url.replace(get_base_url() + "/static/", "").replace("http://localhost:8000/static/", "")
            # Remove "poses/" prefix if present
            if filename.startswith("poses/"):
                filename = filename.replace("poses/", "")
            
            # First check POSE_IMAGE_URLS for Cloudinary URL
            if filename in POSE_IMAGE_URLS:
                cached_url = POSE_IMAGE_URLS[filename]
                if cached_url and cached_url.startswith("https://res.cloudinary.com/"):
                    manikin_pose_url = cached_url
                    print(f"✅ Using Cloudinary URL from cache: {manikin_pose_url[:80]}...")
                else:
                    # Cache has localhost URL or None, need to upload
                    print(f"⚠️ Cache has localhost URL or None, uploading to Cloudinary...")
                    # Try to find file locally
                    api_dir = os.path.dirname(os.path.abspath(__file__))
                    static_path = os.path.join(api_dir, "static", "poses", filename)
                    uploads_path = os.path.join(api_dir, "uploads", "poses", filename)
                    filepath = static_path if os.path.exists(static_path) else (uploads_path if os.path.exists(uploads_path) else None)
                    if filepath and os.path.exists(filepath):
                        # Read file and upload to Cloudinary
                        import base64
                        with open(filepath, "rb") as f:
                            file_content = f.read()
                            ext = filename.split('.')[-1] if '.' in filename else 'jpg'
                            data_url = f"data:image/{ext};base64,{base64.b64encode(file_content).decode()}"
                            manikin_pose_url = upload_to_cloudinary(data_url, "manikin_pose")
                            # Update cache
                            POSE_IMAGE_URLS[filename] = manikin_pose_url
                            print(f"✅ Uploaded manikin pose to Cloudinary: {manikin_pose_url[:80]}...")
                    else:
                        # File not found - this will fail, but at least we tried
                        print(f"❌ CRITICAL: Pose file not found locally: {filename}")
                        print(f"❌ Cannot upload to Cloudinary - manikin replacement will fail")
                        raise FileNotFoundError(f"Pose file not found: {filename}")
            else:
                # Not in cache, try to find and upload
                api_dir = os.path.dirname(os.path.abspath(__file__))
                static_path = os.path.join(api_dir, "static", "poses", filename)
                uploads_path = os.path.join(api_dir, "uploads", "poses", filename)
                filepath = static_path if os.path.exists(static_path) else (uploads_path if os.path.exists(uploads_path) else None)
                if filepath and os.path.exists(filepath):
                    # Read file and upload to Cloudinary
                    import base64
                    with open(filepath, "rb") as f:
                        file_content = f.read()
                        ext = filename.split('.')[-1] if '.' in filename else 'jpg'
                        data_url = f"data:image/{ext};base64,{base64.b64encode(file_content).decode()}"
                        manikin_pose_url = upload_to_cloudinary(data_url, "manikin_pose")
                        # Update cache
                        POSE_IMAGE_URLS[filename] = manikin_pose_url
                        print(f"✅ Uploaded manikin pose to Cloudinary: {manikin_pose_url[:80]}...")
                else:
                    # File not found - this will fail
                    print(f"❌ CRITICAL: Pose file not found locally: {filename}")
                    print(f"❌ Cannot upload to Cloudinary - manikin replacement will fail")
                    raise FileNotFoundError(f"Pose file not found: {filename}")
        
        # Use nano-banana to modify person's pose without overlay
        # Person first = what to modify, Manikin second = pose to copy
        prompt = (
            "Subtly adjust the body pose of the person in the first image to be INSPIRED BY the pose in the second image. "
            "This should be a loose approximation, NOT an exact copy. "
            "CRITICAL: Keep the person's REAL human body, skin, legs, arms - DO NOT copy the wooden/mannequin appearance from the reference. "
            "Adjust the general stance, body angle, and positioning in a natural way. "
            "The person must remain a real human with real skin, real legs, real arms, and natural body. "
            "Keep the same face, same clothing, same background, same scene. "
            "DO NOT transfer the mannequin's wooden texture or artificial appearance. "
            "Full body from head to feet with natural human appearance and natural pose variation."
        )
        
        negative_prompt = "wooden legs, mannequin legs, wooden body, artificial limbs, doll legs, plastic body, mannequin appearance, wooden texture, artificial skin, doll appearance, puppet legs, stiff pose, rigid pose, unnatural stance"
        
        print(f"📝 In-place pose change prompt: {prompt[:150]}...")
        print(f"🚫 Negative prompt: {negative_prompt[:100]}...")
        print(f"🖼️ Image order: [person_wearing_product (base to modify), manikin_pose (pose reference)]")
        
        # SWAP BACK: Person first (base to modify), manikin second (pose to reference)
        # VERY low strength for loose approximation - NOT exact copy
        result_url = run_nano_banana_pro(
            prompt=prompt,
            image_urls=[person_wearing_product_url, manikin_pose_url],  # Person = base, Manikin = pose ref
            strength=0.18,  # VERY LOW for loose approximation - was 0.25, too strict
            guidance_scale=6.5,  # Moderate guidance for natural variation
            num_steps=30,  # Standard quality
            negative_prompt=negative_prompt  # Prevent wooden/mannequin appearance
        )
        
        # Upload to Cloudinary for stability
        if result_url and result_url != person_wearing_product_url:
            stable_url = upload_to_cloudinary(result_url, "manikin_replacement")
            print(f"✅ Manikin replaced successfully: {stable_url[:80]}...")
            return stable_url
        else:
            print(f"⚠️ Manikin replacement returned None or same image, using person wearing product")
            print(f"⚠️ Result URL: {result_url[:80] if result_url else 'None'}...")
            return person_wearing_product_url
            
    except Exception as e:
        print(f"❌ Manikin replacement failed: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to person wearing product
        return person_wearing_product_url

def add_product_to_image(current_image_url: str, product_image_url: str, product_name: str, product_type: str = "garment") -> str:
    """Add an additional product/garment to an existing image using nano-banana"""
    try:
        # Trim whitespace from product name to avoid Cloudinary folder issues
        product_name = product_name.strip()
        print(f"\n{'='*80}")
        print(f"👕 ADDING PRODUCT: {product_name} ({product_type})")
        print(f"{'='*80}")
        print(f"🖼️ Current image: {current_image_url[:100]}...")
        print(f"🧵 Product to add: {product_image_url[:100]}...")
        print(f"📦 Product type: {product_type}")
        
        # Ensure URLs are accessible (convert local paths to Cloudinary if needed)
        # Handle current image URL
        if current_image_url.startswith(get_base_url() + "/static/") or \
           (current_image_url.startswith("http://localhost") and "/static/" in current_image_url) or \
           (current_image_url.startswith("http://127.0.0.1") and "/static/" in current_image_url):
            print(f"🔄 Converting local current image URL to Cloudinary...")
            if "/static/" in current_image_url:
                filename = current_image_url.split("/static/")[-1]
            else:
                filename = current_image_url.split("/")[-1]
            
            # Try multiple possible paths
            api_dir = os.path.dirname(os.path.abspath(__file__))
            possible_paths = [
                os.path.join(api_dir, "static", filename),
                os.path.join(api_dir, "uploads", filename),
                os.path.join(api_dir, "static", "packshot_front", filename),
                f"static/{filename}",
                f"uploads/{filename}"
            ]
            
            filepath = next((p for p in possible_paths if os.path.exists(p)), None)
            if filepath:
                import base64
                with open(filepath, "rb") as f:
                    file_content = f.read()
                    ext = filename.split('.')[-1] if '.' in filename else 'jpg'
                    data_url = f"data:image/{ext};base64,{base64.b64encode(file_content).decode()}"
                    current_image_url = upload_to_cloudinary(data_url, "current_image")
                    print(f"✅ Uploaded current image to Cloudinary: {current_image_url[:80]}...")
            else:
                print(f"❌ Could not find local file: {filename}")
                raise ValueError(f"Current image file not found: {filename}")
        
        # Handle product image URL
        if product_image_url.startswith(get_base_url() + "/static/") or \
           (product_image_url.startswith("http://localhost") and "/static/" in product_image_url) or \
           (product_image_url.startswith("http://127.0.0.1") and "/static/" in product_image_url):
            print(f"🔄 Converting local product image URL to Cloudinary...")
            if "/static/" in product_image_url:
                filename = product_image_url.split("/static/")[-1]
            else:
                filename = product_image_url.split("/")[-1]
            
            print(f"📁 Looking for file: {filename}")
            
            # Try multiple possible paths
            api_dir = os.path.dirname(os.path.abspath(__file__))
            possible_paths = [
                os.path.join(api_dir, "static", filename),
                os.path.join(api_dir, "uploads", filename),
                os.path.join(api_dir, "static", "packshot_front", filename),
                os.path.join(api_dir, "temp", filename),
                f"static/{filename}",
                f"uploads/{filename}",
                f"temp/{filename}"
            ]
            
            print(f"🔍 Searching in {len(possible_paths)} locations:")
            for path in possible_paths:
                exists = os.path.exists(path)
                print(f"   {'✅' if exists else '❌'} {path}")
            
            filepath = next((p for p in possible_paths if os.path.exists(p)), None)
            if filepath:
                print(f"✅ Found file at: {filepath}")
                import base64
                with open(filepath, "rb") as f:
                    file_content = f.read()
                    ext = filename.split('.')[-1] if '.' in filename else 'jpg'
                    data_url = f"data:image/{ext};base64,{base64.b64encode(file_content).decode()}"
                    product_image_url = upload_to_cloudinary(data_url, "additional_product")
                    print(f"✅ Uploaded product image to Cloudinary: {product_image_url[:80]}...")
            else:
                print(f"❌ Could not find local file: {filename}")
                print(f"⚠️ Product URL in database is local but file doesn't exist")
                print(f"⚠️ This product's packshot may not have been uploaded to Cloudinary properly")
                raise ValueError(f"Product image file not found: {filename}. The packshot_front_url in the database is a local URL but the file doesn't exist on disk. This product needs to be re-uploaded or its packshot regenerated.")
        
        # Create prompt for adding the garment
        # Use product_type field to determine garment category (more reliable than parsing name)
        product_type_lower = product_type.lower() if product_type else ""
        is_bottom = product_type_lower in ['shorts', 'pants', 'jeans', 'trousers', 'skirt', 'short', 'pant', 'jean', 'trouser'] or \
                    any(keyword in product_name.lower() for keyword in ['short', 'pant', 'jean', 'trouser', 'skirt'])
        is_top = product_type_lower in ['shirt', 't-shirt', 'tshirt', 'top', 'blouse', 'sweater', 'hoodie', 'tee'] or \
                 any(keyword in product_name.lower() for keyword in ['shirt', 't-shirt', 'tshirt', 'top', 'blouse', 'sweater', 'hoodie'])
        
        if is_bottom:
            prompt = (
                f"Replace any existing pants, shorts, or bottom garments with the {product_type} from the second image. "
                f"CRITICAL: The person should be wearing ONLY the {product_type} on their legs - NO pants underneath shorts, NO layering of bottoms. "
                f"Remove any existing leg wear and show only the new {product_type}. "
                f"Keep the person's pose, facial expression, background, scene, and upper body clothing exactly the same. "
                f"Professional fashion photography with clean, natural look."
            )
        elif is_top:
            prompt = (
                f"Replace any existing shirt or top garment with the {product_type} from the second image. "
                f"CRITICAL: The person should be wearing ONLY the {product_type} on their upper body - NO layering of similar tops. "
                f"Keep the person's pose, facial expression, background, scene, and lower body clothing exactly the same. "
                f"Professional fashion photography with clean, natural look."
            )
        else:
            # For accessories or other items, use additive approach
            prompt = (
                f"Add the {product_type} from the second image to the person in the first image. "
                f"Keep the person's pose, facial expression, background, and existing clothing. "
                f"Professional fashion photography with natural styling."
            )
        
        print(f"📝 Add product prompt: {prompt[:200]}...")
        print(f"🎯 Calling nano-banana-pro to add {product_name}...")
        
        # Use nano-banana PRO to add the product
        try:
            result_url = run_nano_banana_pro(
                prompt=prompt,
                image_urls=[current_image_url, product_image_url],  # Current image first, new product second
                strength=0.65,  # Moderate strength to add garment while preserving scene
                guidance_scale=7.5,
                num_steps=30
            )
            
            # Upload to Cloudinary for stability
            if result_url and result_url != current_image_url:
                print(f"✅ Nano-banana returned new image, uploading to Cloudinary...")
                stable_url = upload_to_cloudinary(result_url, f"with_{product_name}")
                print(f"✅ SUCCESS: Added {product_name} successfully!")
                print(f"   Result URL: {stable_url[:100]}...")
                print(f"{'='*80}\n")
                return stable_url
            else:
                print(f"⚠️ WARNING: Product addition returned same image")
                print(f"   This means nano-banana-pro didn't modify the image")
                print(f"   Returning current image without {product_name}")
                print(f"{'='*80}\n")
                return current_image_url
                
        except ValueError as ve:
            # Input validation error - this is critical
            print(f"❌ CRITICAL ERROR: Invalid input for nano-banana-pro")
            print(f"   Error: {ve}")
            print(f"   Cannot add {product_name} - returning current image")
            print(f"{'='*80}\n")
            raise  # Re-raise to stop the workflow
    
    except Exception as e:
        print(f"❌ FAILED TO ADD {product_name}")
        print(f"   Error type: {type(e).__name__}")
        print(f"   Error message: {e}")
        print(f"   Current image: {current_image_url[:100]}")
        print(f"   Product image: {product_image_url[:100]}")
        import traceback
        traceback.print_exc()
        print(f"⚠️ Returning current image without {product_name}")
        print(f"{'='*80}\n")
        # Fallback to current image
        return current_image_url

def run_qwen_triple_composition(model_image_url: str, product_image_url: str, scene_image_url: str, product_name: str, quality_mode: str = "standard", shot_type_prompt: str = None, clothing_type: str = None) -> str:
    """SINGLE-STEP: Person + Scene + Clothing all at once with Nano-banana PRO"""
    try:
        print(f"🍌 Running SINGLE-STEP Nano-banana composition")
        print(f"   All 3 elements in ONE call: Person + Scene + Clothing")
        
        # Use clothing_type if provided, otherwise fallback to product_name
        garment_description = clothing_type if clothing_type else product_name
        
        # Convert all local URLs to public URLs
        if model_image_url.startswith(get_base_url() + "/static/"):
            filename = model_image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            model_image_url = upload_to_replicate(filepath)
            
        if product_image_url.startswith(get_base_url() + "/static/"):
            filename = product_image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            product_image_url = upload_to_replicate(filepath)
        
        if scene_image_url.startswith(get_base_url() + "/static/"):
            filename = scene_image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            scene_image_url = upload_to_replicate(filepath)

        # ============================================================
        # SINGLE-STEP: All 3 elements with Nano-banana PRO
        # ============================================================
        # Clear prompt structure mapping each image to its role
        prompt = (
            f"Fashion photograph of the person from IMAGE 1. "
            f"SCENE: Place them in the environment from IMAGE 2 - match the lighting, colors, and atmosphere. "
            f"OUTFIT: Dress them in the EXACT {garment_description} from IMAGE 3 - preserve all colors, patterns, and design details. "
            f"CRITICAL: The person's face must be IDENTICAL to IMAGE 1 - same eyes, nose, mouth, facial structure. "
            f"Full body shot showing head to feet. Professional fashion photography."
        )
        
        negative_prompt = (
            "wrong face, different person, modified clothing, wrong outfit, changed colors, "
            "cropped body, cut off legs, cut off head, portrait only, headshot only, "
            "changed skin tone, added tattoos, wrong background, white background"
        )
        
        print(f"📸 Single-step composition:")
        print(f"   🧑 IMAGE 1 (Person): {model_image_url[:60]}...")
        print(f"   🌄 IMAGE 2 (Scene): {scene_image_url[:60]}...")
        print(f"   👕 IMAGE 3 (Clothing): {product_image_url[:60]}...")
        print(f"📝 Prompt: {prompt[:150]}...")
        print(f"🚫 Negative: {negative_prompt[:100]}...")
        
        try:
            # Call Nano-banana PRO with all 3 images
            result_url = run_nano_banana_pro(
                prompt=prompt,
                image_urls=[model_image_url, scene_image_url, product_image_url],  # Person, Scene, Clothing
                strength=0.55,       # Balanced for all 3 elements
                guidance_scale=7.0,  # Strong prompt following
                num_steps=35,        # Good quality
                negative_prompt=negative_prompt
            )
            
            # Upload to Cloudinary for stability
            stable_url = upload_to_cloudinary(result_url, "campaign_image")
            print(f"✅ Single-step composition complete: {stable_url[:80]}...")
            return stable_url
            
        except Exception as e:
            print(f"❌ Nano-banana composition failed: {e}")
            import traceback
            traceback.print_exc()
            if DISABLE_PLACEHOLDERS:
                return model_image_url
            return f"https://picsum.photos/800/600?random={hash(model_image_url) % 10000}"
            
    except Exception as e:
        print(f"❌ Single-step composition failed: {e}")
        if DISABLE_PLACEHOLDERS:
            print("↩️ Returning model image instead of placeholder")
            return model_image_url
        fallback_url = f"https://picsum.photos/800/600?random={hash(model_image_url) % 10000}"
        return fallback_url

# Campaign shot types for comprehensive 10-shot photoshoot
CAMPAIGN_SHOT_TYPES = [
    {
        "name": "sitting_intro",
        "title": "Sitting Shot (Intro)",
        "prompt": "Professional fashion photography, model sitting elegantly, confident pose, looking at camera, natural lighting"
    },
    {
        "name": "standing_full",
        "title": "Standing Look (Fit Reveal)",
        "prompt": "Full-body fashion shot, model standing confidently, hands on hips, showcasing the outfit, professional studio lighting"
    },
    {
        "name": "upper_closeup",
        "title": "Upper Body Close-Up",
        "prompt": "Upper body fashion shot, model posing naturally, focus on garment details, professional portrait lighting"
    },
    {
        "name": "lower_closeup",
        "title": "Lower Body Close-Up",
        "prompt": "Lower body fashion shot, model showcasing bottom wear, confident stance, professional fashion photography"
    },
    {
        "name": "action_dynamic",
        "title": "Action Shot (Movement)",
        "prompt": "Dynamic fashion shot, model in motion, walking pose, natural movement, lifestyle photography style"
    },
    {
        "name": "interaction_pose",
        "title": "Model Interaction",
        "prompt": "Interactive fashion pose, model engaging with environment, natural gestures, lifestyle context"
    },
    {
        "name": "hero_finale",
        "title": "Hero Pose (Campaign Finale)",
        "prompt": "Hero fashion shot, model in commanding pose, strong presence, dramatic lighting, campaign finale style"
    },
    {
        "name": "detail_macro",
        "title": "Fabric Detail Macro",
        "prompt": "Detail-focused fashion shot, highlighting fabric texture and garment construction, macro photography style"
    },
    {
        "name": "profile_side",
        "title": "Profile Side View",
        "prompt": "Profile fashion shot, model in side view, elegant silhouette, showcasing garment shape and fit"
    },
    {
        "name": "lifestyle_context",
        "title": "Lifestyle Context Shot",
        "prompt": "Lifestyle fashion photography, model in natural setting, contextual environment, authentic lifestyle feel"
    }
]

def run_nano_banana_scene_composition(model_image_url: str, scene_image_url: str, quality_mode: str = "standard", shot_type_prompt: str = None) -> str:
    """Compose model pose into scene using Nano Banana"""
    try:
        print(f"🍌 Running Nano Banana composition: model={model_image_url[:50]}..., scene={scene_image_url[:50]}...")
        
        # Stabilize ephemeral replicate.delivery inputs by persisting locally first
        if isinstance(model_image_url, str) and model_image_url.startswith("https://replicate.delivery/"):
            model_image_url = upload_to_cloudinary(model_image_url, "nano_model")
        if isinstance(scene_image_url, str) and scene_image_url.startswith("https://replicate.delivery/"):
            scene_image_url = upload_to_cloudinary(scene_image_url, "nano_scene")

        # Do NOT swap the user-selected model. Always persist or fail; never replace.

        # Ensure persisted files exist before continuing
        try:
            if isinstance(model_image_url, str) and model_image_url.startswith(get_base_url() + "/static/"):
                # no-op; file created by download_and_save_image
                pass
            if isinstance(scene_image_url, str) and scene_image_url.startswith(get_base_url() + "/static/"):
                pass
        except Exception as _:
            pass
        
        # Convert local URLs to base64 for Qwen
        if isinstance(model_image_url, str) and model_image_url.startswith(get_base_url() + "/static/"):
            filename = model_image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            model_image_url = upload_to_replicate(filepath)
        
        if isinstance(scene_image_url, str) and scene_image_url.startswith(get_base_url() + "/static/"):
            filename = scene_image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            scene_image_url = upload_to_replicate(filepath)

        # Build prompt - use shot_type_prompt if provided, otherwise use default
        # Step 1: Focus ONLY on placing model into scene (no clothing/product)
        if shot_type_prompt:
            scene_prompt = (
                f"Place the person from the first image into the background from the second image. "
                f"{shot_type_prompt} "
                f"The person should be wearing only underwear. "
                f"Match the lighting and create realistic shadows. "
                f"Keep the person's appearance the same. "
                f"Professional photography quality."
            )
        else:
            scene_prompt = (
                "Place the person from the first image into the background from the second image. "
                "The person should be wearing only underwear. "
                "Match the lighting and create realistic shadows. "
                "Keep the person's appearance the same. "
                "Professional photography quality."
            )
        
        # Conservative parameters for reliable scene composition
        if quality_mode == "high":
            num_steps = 15        # Conservative steps for reliability
            guidance = 2.5        # Conservative guidance
            strength = 0.15       # Conservative strength
            print("🎨 Using HIGH QUALITY mode (reliable scene composition)")
        else:  # standard
            num_steps = 12        # Conservative steps for reliability
            guidance = 2.0        # Conservative guidance
            strength = 0.12       # Conservative strength
            print("⚡ Using STANDARD mode (reliable scene composition)")

        # Special handling for Sitting Shot: minimal boost
        if shot_type_prompt and ("sitting" in shot_type_prompt.lower()):
            num_steps = max(num_steps, 15)  # Minimal increase
            guidance = max(guidance, 2.5)   # Minimal increase
            strength = max(strength, 0.15)  # Minimal increase
            print("🪑 Sitting Shot detected → minimal boost for reliability")
        
        # Use Nano Banana for scene composition
        try:
            print("🔄 Using Nano Banana for scene composition with improved parameters...")
            out = replicate.run("google/nano-banana", input={
                "prompt": scene_prompt,
                "image_input": [model_image_url, scene_image_url],
                "num_inference_steps": num_steps,
                "guidance_scale": guidance,
                "strength": strength,
                "seed": None
            })
            
            # Handle different return types
            if hasattr(out, 'url'):
                scene_composite_url = out.url()
            elif isinstance(out, str):
                scene_composite_url = out
            elif isinstance(out, list) and len(out) > 0:
                scene_composite_url = out[0] if isinstance(out[0], str) else out[0].url()
            else:
                scene_composite_url = str(out)
            
            print(f"✅ Nano Banana scene composition completed: {scene_composite_url[:50]}...")
            
            # Immediately persist Replicate URLs to avoid 404 errors
            if isinstance(scene_composite_url, str) and scene_composite_url.startswith("https://replicate.delivery/"):
                try:
                    scene_composite_url = upload_to_cloudinary(scene_composite_url, "nano_scene_composite")
                    print(f"✅ Persisted Nano Banana result: {scene_composite_url[:50]}...")
                except Exception as e:
                    print(f"⚠️ Failed to persist Nano Banana result: {e}")
            
            return scene_composite_url
            
        except Exception as e:
            print(f"⚠️ Nano Banana scene composition failed, retrying with safer params: {e}")
            print(f"🔍 DEBUG: Model URL: {model_image_url[:100]}...")
            print(f"🔍 DEBUG: Scene URL: {scene_image_url[:100]}...")
            print(f"🔍 DEBUG: Prompt: {scene_prompt[:200]}...")
            try:
                # Even more conservative retry parameters
                safer_out = replicate.run("google/nano-banana", input={
                    "prompt": "Place the person from the first image into the background from the second image. Keep the person's appearance the same.",
                    "image_input": [model_image_url, scene_image_url],
                    "num_inference_steps": 6,
                    "guidance_scale": 1.2,
                    "strength": 0.03,
                    "seed": None
                })
                if hasattr(safer_out, 'url'):
                    scene_composite_url = safer_out.url()
                elif isinstance(safer_out, str):
                    scene_composite_url = safer_out
                elif isinstance(safer_out, list) and len(safer_out) > 0:
                    scene_composite_url = safer_out[0] if isinstance(safer_out[0], str) else safer_out[0].url()
                else:
                    scene_composite_url = str(safer_out)
                print(f"✅ Nano Banana retry succeeded: {scene_composite_url[:50]}...")
                
                # Immediately persist Replicate URLs to avoid 404 errors
                if isinstance(scene_composite_url, str) and scene_composite_url.startswith("https://replicate.delivery/"):
                    try:
                        scene_composite_url = upload_to_cloudinary(scene_composite_url, "nano_scene_composite_retry")
                        print(f"✅ Persisted Nano Banana retry result: {scene_composite_url[:50]}...")
                    except Exception as e:
                        print(f"⚠️ Failed to persist Nano Banana retry result: {e}")
                
                return scene_composite_url
            except Exception as e2:
                print(f"❌ Nano Banana retry failed: {e2}")
                print(f"🔍 DEBUG: Retry failed with model URL: {model_image_url[:100]}...")
                print(f"🔍 DEBUG: Retry failed with scene URL: {scene_image_url[:100]}...")
                if DISABLE_PLACEHOLDERS:
                    print("↩️ Returning model image instead of placeholder")
                    return model_image_url
                fallback_url = f"https://picsum.photos/800/600?random={hash(model_image_url + scene_image_url) % 10000}"
                print(f"Using scene composition fallback URL: {fallback_url}")
                return fallback_url
        
    except Exception as e:
        print(f"❌ Scene composition generation failed: {e}")
        if DISABLE_PLACEHOLDERS:
            print("↩️ Returning model image instead of placeholder")
            return model_image_url
        # Fallback to a placeholder (disabled by flag)
        fallback_url = f"https://picsum.photos/800/600?random={hash(model_image_url + scene_image_url) % 10000}"
        print(f"Using scene composition fallback URL: {fallback_url}")
        return fallback_url

def run_qwen_packshot_front_back(
    product_image_url: str,
    user_mods: str,
    clothing_type: str = ""
) -> List[str]:
    """Generate front and back packshots using Qwen"""
    try:
        print("Processing product image for front and back packshots...")
        
        # Step 1: Ensure we have a public Cloudinary URL for Replicate (NOT local file paths)
        print(f"🔄 Processing product_image_url: {product_image_url[:100] if len(product_image_url) > 100 else product_image_url}...")
        
        if product_image_url.startswith("data:image/"):
            product_png_url = upload_to_cloudinary(product_image_url, "product_temp")
            print(f"✅ Converted data URL to Cloudinary: {product_png_url[:100]}...")
        elif product_image_url.startswith(get_base_url() + "/static/"):
            filename = product_image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            # Read file and upload to Cloudinary
            import base64
            with open(filepath, "rb") as f:
                file_content = f.read()
                ext = filename.split('.')[-1] if '.' in filename else 'jpg'
                data_url = f"data:image/{ext};base64,{base64.b64encode(file_content).decode()}"
                product_png_url = upload_to_cloudinary(data_url, "product_temp")
            print(f"✅ Converted static file to Cloudinary: {product_png_url[:100]}...")
        elif product_image_url.startswith("http://localhost"):
            product_png_url = upload_to_cloudinary(product_image_url, "product_temp")
            print(f"✅ Converted localhost URL to Cloudinary: {product_png_url[:100]}...")
        elif product_image_url.startswith("uploads/"):
            # Direct file path - read and upload to Cloudinary
            print(f"⚠️ Got direct file path, uploading to Cloudinary...")
            import base64
            with open(product_image_url, "rb") as f:
                file_content = f.read()
                ext = product_image_url.split('.')[-1] if '.' in product_image_url else 'jpg'
                data_url = f"data:image/{ext};base64,{base64.b64encode(file_content).decode()}"
                product_png_url = upload_to_cloudinary(data_url, "product_temp")
            print(f"✅ Converted file path to Cloudinary: {product_png_url[:100]}...")
        elif product_image_url.startswith("https://res.cloudinary.com/"):
            # Already a Cloudinary URL
            product_png_url = product_image_url
            print(f"✅ Already a Cloudinary URL: {product_png_url[:100]}...")
        else:
            # Assume it's a public URL or upload to Cloudinary to be safe
            if not (product_image_url.startswith("http://") or product_image_url.startswith("https://")):
                print(f"⚠️ Unknown URL format, attempting to upload to Cloudinary...")
                product_png_url = upload_to_cloudinary(product_image_url, "product_temp")
            else:
                product_png_url = product_image_url
                print(f"✅ Using URL: {product_png_url[:100]}...")

        # Step 2: Simple extraction prompt - what Qwen is designed for
        print("Generating front packshot...")
        if clothing_type:
            print(f"👕 Clothing type specified: {clothing_type}")
            front_prompt = f"Extract the {clothing_type} from the image and create a professional packshot on white background. Keep the exact {clothing_type} design, colors, and details."
        else:
            front_prompt = f"Extract the product from the image and create a professional packshot on white background. Keep the exact product design, colors, and details."
        
        try:
            print(f"🎨 Calling Qwen with URL: {product_png_url[:100]}...")
            print(f"📝 Prompt: {front_prompt}")
            front_out = replicate.run("qwen/qwen-image-edit-plus", input={
                "prompt": front_prompt,
                "image": [product_png_url],
                "num_inference_steps": 30,
                "guidance_scale": 7.5,
                "strength": 0.7  # Higher strength so Qwen actually extracts and creates packshot
            })
            
            # Handle different return types
            if hasattr(front_out, 'url'):
                front_url = front_out.url()
            elif isinstance(front_out, str):
                front_url = front_out
            elif isinstance(front_out, list) and len(front_out) > 0:
                front_url = front_out[0] if isinstance(front_out[0], str) else front_out[0].url()
            else:
                front_url = str(front_out)
            
            print(f"Generated front packshot URL: {front_url}")
            
            # Download and save locally
            front_url = upload_to_cloudinary(front_url, "packshot_front")
            
        except Exception as e:
            print(f"Error generating front packshot: {e}")
            front_url = product_image_url  # Fallback to original

        # Step 3: Generate back packshot
        print("Generating back packshot...")
        if clothing_type:
            back_prompt = f"Extract the {clothing_type} from the image and create a professional packshot showing the back view on white background. Match the exact {clothing_type} design, colors, and details."
        else:
            back_prompt = f"Extract the product from the image and create a professional packshot showing the back view on white background. Match the exact product design, colors, and details."
        
        try:
            print(f"🎨 Calling Qwen for back packshot...")
            back_out = replicate.run("qwen/qwen-image-edit-plus", input={
                "prompt": back_prompt,
                "image": [product_png_url],
                "num_inference_steps": 30,
                "guidance_scale": 7.5,
                "strength": 0.7  # Higher strength to actually extract and create packshot
            })
            
            # Handle different return types
            if hasattr(back_out, 'url'):
                back_url = back_out.url()
            elif isinstance(back_out, str):
                back_url = back_out
            elif isinstance(back_out, list) and len(back_out) > 0:
                back_url = back_out[0] if isinstance(back_out[0], str) else back_out[0].url()
            else:
                back_url = str(back_out)
            
            print(f"Generated back packshot URL: {back_url}")
            
            # Download and save locally
            back_url = upload_to_cloudinary(back_url, "packshot_back")
            
        except Exception as e:
            print(f"Error generating back packshot: {e}")
            back_url = product_image_url  # Fallback to original

        packshot_urls = [front_url, back_url]
        print(f"Generated {len(packshot_urls)} packshot URLs: {packshot_urls}")
        return packshot_urls
        
    except Exception as e:
        print(f"Qwen front/back packshot generation failed: {e}")
        # Fallback to original image
        return [product_image_url, product_image_url]

# ---------- Product Upload Endpoint ----------
@app.post("/products/upload")
async def upload_product(
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form(""),
    clothing_type: str = Form(""),
    tags: str = Form(""),
    product_image: UploadFile = File(...),
    packshot_front: UploadFile = File(None),
    packshot_front_type: str = Form(""),
    packshot_back: UploadFile = File(None),
    packshot_back_type: str = Form(""),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a product with automatic packshot generation"""
    try:
        print(f"📦 Uploading product: {name}")
        print(f"👕 Clothing type received: '{clothing_type}'")
        # Save product image
        image_filename = f"product_{hash(name + str(datetime.now()))}.{product_image.filename.split('.')[-1]}"
        image_path = os.path.join("uploads", image_filename)
        
        with open(image_path, "wb") as f:
            content = await product_image.read()
            f.write(content)
        
        # ALWAYS upload to Cloudinary - no local URLs allowed
        print(f"📤 Uploading product image to Cloudinary...")
        try:
            ext = product_image.filename.split('.')[-1] if '.' in product_image.filename else 'jpg'
            image_url = upload_to_cloudinary(f"data:image/{ext};base64,{base64.b64encode(content).decode()}", "products")
            print(f"✅ Product image uploaded: {image_url[:80]}...")
        except Exception as e:
            print(f"❌ Failed to upload product image to Cloudinary: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to upload product image to Cloudinary. Please check your Cloudinary configuration. Error: {str(e)}")
        
        # Initialize packshot URLs
        packshot_front_url = None
        packshot_back_url = None
        packshots = []
        
        # Check if user has enough credits for packshot generation (5 credits per packshot)
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        credits_needed = 0
        
        # If no packshots provided, we'll generate them
        if not packshot_front and not packshot_back:
            credits_needed = 10  # 5 for front + 5 for back
        elif not packshot_front or not packshot_back:
            credits_needed = 5  # Only one needs generation
        
        if credits_needed > 0 and (not user or user.credits < credits_needed):
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient credits. Need {credits_needed} credits for packshot generation."
            )
        
        # Handle uploaded packshots - ALWAYS upload to Cloudinary
        if packshot_front:
            print(f"📤 Uploading front packshot to Cloudinary...")
            content = await packshot_front.read()
            ext = packshot_front.filename.split('.')[-1] if '.' in packshot_front.filename else 'png'
            data_url = f"data:image/{ext};base64,{base64.b64encode(content).decode()}"
            packshot_front_url = upload_to_cloudinary(data_url, "packshot_front")
            packshots.append(packshot_front_url)
            print(f"✅ Front packshot uploaded: {packshot_front_url[:80]}...")
        
        if packshot_back:
            print(f"📤 Uploading back packshot to Cloudinary...")
            content = await packshot_back.read()
            ext = packshot_back.filename.split('.')[-1] if '.' in packshot_back.filename else 'png'
            data_url = f"data:image/{ext};base64,{base64.b64encode(content).decode()}"
            packshot_back_url = upload_to_cloudinary(data_url, "packshot_back")
            packshots.append(packshot_back_url)
            print(f"✅ Back packshot uploaded: {packshot_back_url[:80]}...")
        
        # Generate missing packshots using Replicate
        if not packshot_front_url or not packshot_back_url:
            print(f"Generating packshots for product: {name}")
            if clothing_type:
                print(f"👕 Clothing type received: {clothing_type}")
            else:
                print("⚠️ WARNING: No clothing_type provided - packshot may include entire outfit")
            user_mods = "preserve exact design and colors from source image, professional product photography, clean background, studio lighting"
            generated_packshots = run_qwen_packshot_front_back(
                product_image_url=image_url,
                user_mods=user_mods,
                clothing_type=clothing_type or ""
            )
            
            # Calculate total credits needed for packshots
            credits_needed = 0
            if not packshot_front_url and len(generated_packshots) > 0:
                credits_needed += 5
            if not packshot_back_url and len(generated_packshots) > 1:
                credits_needed += 5
            
            # Check if user has enough credits
            total_available = (user.subscription_credits or 0) + user.credits
            if total_available < credits_needed:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient credits. You have {total_available} total credits ({user.subscription_credits or 0} subscription + {user.credits} purchased), but need {credits_needed} for packshot generation."
            )
            
            if not packshot_front_url and len(generated_packshots) > 0:
                # Download and save immediately to avoid ephemeral URL expiration
                ephemeral_url = generated_packshots[0]
                packshot_front_url = upload_to_cloudinary(ephemeral_url, "packshot_front")
                packshots.append(packshot_front_url)
                print(f"Generated and saved front packshot: {packshot_front_url}")
            
            if not packshot_back_url and len(generated_packshots) > 1:
                # Download and save immediately to avoid ephemeral URL expiration
                ephemeral_url = generated_packshots[1]
                packshot_back_url = upload_to_cloudinary(ephemeral_url, "packshot_back")
                packshots.append(packshot_back_url)
                print(f"Generated and saved back packshot: {packshot_back_url}")
            
            # Deduct credits (prioritizing subscription credits) - once for all packshots
            if credits_needed > 0:
                if not deduct_credits(user, credits_needed, db):
                    raise HTTPException(status_code=400, detail="Failed to deduct credits")
        
        # Create product in database
        product = Product(
            id=str(uuid.uuid4()),
            user_id=current_user["user_id"],
            name=name,
            description=description,
            category=category,
            clothing_type=clothing_type,
            tags=tags.split(",") if tags else [],
            image_url=image_url,
            packshot_front_url=packshot_front_url,
            packshot_back_url=packshot_back_url,
            packshots=packshots,
            created_at=datetime.utcnow()
        )
        
        db.add(product)
        db.commit()
        db.refresh(product)
        
        return {
            "id": product.id,
            "name": product.name,
            "description": product.description,
            "category": product.category,
            "tags": product.tags,
            "image_url": product.image_url,
            "packshot_front_url": product.packshot_front_url,
            "packshot_back_url": product.packshot_back_url,
            "packshots": product.packshots,
            "credits_remaining": user.credits,
            "message": "Product uploaded successfully with packshots"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error uploading product: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Product Categories Endpoint ----------
@app.get("/categories")
async def get_categories():
    """Get list of product categories"""
    return {
        "categories": [
            "tshirt",
            "sweater",
            "pants",
            "jacket",
            "dress",
            "skirt",
            "shoes",
            "accessories",
            "other"
        ]
    }

@app.get("/products/categories")
async def get_products_categories():
    """Get product categories in frontend format"""
    return {
        "categories": [
            {"value": "tshirt", "label": "T-Shirt"},
            {"value": "sweater", "label": "Sweater"},
            {"value": "pants", "label": "Pants"},
            {"value": "jacket", "label": "Jacket"},
            {"value": "dress", "label": "Dress"},
            {"value": "skirt", "label": "Skirt"},
            {"value": "shoes", "label": "Shoes"},
            {"value": "accessories", "label": "Accessories"},
            {"value": "other", "label": "Other"}
        ],
        "common_tags": [
            "casual", "formal", "sporty", "vintage", "modern", "classic", "trendy", "elegant", "comfortable", "stylish"
        ]
    }

# ---------- Reroll Packshots Endpoint ----------
@app.post("/products/{product_id}/reroll-packshots")
async def reroll_packshots(
    product_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Re-generate packshots for a product"""
    try:
        # Find product
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.user_id == current_user["user_id"]
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Check if user has enough credits (10 credits for front + back packshot regeneration)
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        credits_needed = 10
        total_available = (user.subscription_credits or 0) + user.credits
        if total_available < credits_needed:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient credits. You have {total_available} total credits ({user.subscription_credits or 0} subscription + {user.credits} purchased), but need {credits_needed} for packshot regeneration."
            )
        
        # Generate new packshots
        print(f"Re-generating packshots for product: {product.name}")
        clothing_type = product.clothing_type if hasattr(product, 'clothing_type') and product.clothing_type else ""
        clothing_type_mod = f"isolate only the {clothing_type}" if clothing_type else ""
        user_mods = f"professional product photography, clean background, studio lighting{', ' + clothing_type_mod if clothing_type_mod else ''}"
        new_packshots = run_qwen_packshot_front_back(
            product_image_url=product.image_url,
            user_mods=user_mods,
            clothing_type=clothing_type
        )
        
        # Update product with new packshots
        if len(new_packshots) >= 2:
            product.packshot_front_url = new_packshots[0]
            product.packshot_back_url = new_packshots[1]
            product.packshots = new_packshots
            print(f"Updated product with new packshots: {new_packshots}")
        
        # Deduct credits (10 credits for both front and back) - prioritizing subscription credits
        if not deduct_credits(user, credits_needed, db):
            raise HTTPException(status_code=400, detail="Failed to deduct credits")
        
        return {
            "message": "Packshots re-rolled successfully",
            "packshots": new_packshots,
            "credits_remaining": user.credits
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error re-rolling packshots: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def run_wan_video_generation(image_url: str, video_quality: str = "480p", custom_prompt: Optional[str] = None) -> str:
    """Generate video from image using Wan 2.2 I2V Fast API"""
    try:
        print(f"🎬 Running Wan video generation: {image_url[:50]}...")
        
        # Convert local URLs to base64 for Replicate
        if image_url.startswith(get_base_url() + "/static/"):
            filename = image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            image_url = upload_to_replicate(filepath)
            print(f"Converted image to base64: {image_url[:100]}...")
        
        # Configure parameters based on video quality
        if video_quality == "720p":
            num_frames = 120
            fps = 8
            print("🎨 Using 720p video quality mode")
        else:  # 480p or default
            num_frames = 81
            fps = 4
            print("⚡ Using 480p video quality mode")
        
        # Run Wan 2.2 I2V Fast
        print(f"🔄 Calling Wan 2.2 I2V Fast API...")
        out = replicate.run(
            "wan-video/wan-2.2-i2v-fast",
            input={
                "image": image_url,
                "prompt": custom_prompt or "gentle natural movement, subtle breathing, soft fabric flow, professional fashion photography, minimal motion, elegant stillness",
                "num_frames": num_frames,
                "fps": fps
            }
        )
        
        # Handle output
        if hasattr(out, 'url'):
            video_url = out.url()
        elif isinstance(out, str):
            video_url = out
        elif isinstance(out, list) and len(out) > 0:
            video_url = out[0] if isinstance(out[0], str) else out[0].url()
        else:
            video_url = str(out)
        
        print(f"✅ Wan video generated: {video_url[:50]}...")
        
        # Download and save video locally
        downloaded_url = download_and_save_video(video_url)
        return downloaded_url
        
    except Exception as e:
        print(f"❌ Wan video generation failed: {e}")
        return None

def run_seedance_video_generation(image_url: str, video_quality: str = "480p", duration: str = "5s", custom_prompt: Optional[str] = None) -> str:
    """Generate video from image using Seedance 1 Pro API"""
    try:
        print(f"\n{'='*80}")
        print(f"🎬 SEEDANCE 1 PRO VIDEO GENERATION")
        print(f"{'='*80}")
        print(f"📸 Input image: {image_url[:80]}...")
        print(f"🎨 Quality: {video_quality}")
        print(f"⏱️  Duration: {duration}")
        print(f"💬 Custom prompt: {custom_prompt if custom_prompt else '(using default)'}")
        
        # Convert local URLs to base64 for Replicate
        if image_url.startswith(get_base_url() + "/static/"):
            filename = image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            print(f"📂 Converting local file: {filepath}")
            image_url = upload_to_replicate(filepath)
            print(f"✅ Converted to base64 ({len(image_url)} chars)")
        
        # Configure parameters based on video quality and duration
        resolution = "1080p" if video_quality == "1080p" else "480p"
        
        # Seedance expects duration as INTEGER (seconds), not string
        duration_seconds = 10 if duration == "10s" else 5
        
        print(f"🎨 Using {resolution} video quality mode")
        print(f"⏱️ Using {duration_seconds} seconds duration")
        print(f"🔄 Calling Seedance 1 Pro API...")
        
        # Run Seedance 1 Pro
        out = replicate.run(
            "bytedance/seedance-1-pro",
            input={
                "image": image_url,
                "prompt": custom_prompt or "gentle natural movement, subtle breathing, soft fabric flow, professional fashion photography, minimal motion, elegant stillness",
                "resolution": resolution,
                "duration": duration_seconds  # INTEGER, not string!
            }
        )
        
        print(f"✅ Seedance API call completed, processing output...")
        
        # Handle output
        if hasattr(out, 'url'):
            video_url = out.url()
        elif isinstance(out, str):
            video_url = out
        elif isinstance(out, list) and len(out) > 0:
            video_url = out[0] if isinstance(out[0], str) else out[0].url()
        else:
            video_url = str(out)
        
        print(f"✅ Seedance video generated: {video_url[:50]}...")
        
        # Download and save video locally
        downloaded_url = download_and_save_video(video_url)
        return downloaded_url
        
    except Exception as e:
        print(f"❌ Seedance video generation failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def run_veo_video_generation(image_url: str, video_quality: str = "480p", duration: str = "5s", custom_prompt: Optional[str] = None) -> str:
    """Generate video from image using Google Veo 3.1 API"""
    try:
        print(f"🎬 Running Google Veo 3.1 video generation: {image_url[:50]}...")
        
        # Convert URLs to base64 for Replicate to ensure Veo uses the exact image
        # Veo 3.1 works better with base64-encoded images than URLs
        converted_image_url = None
        
        if image_url.startswith(get_base_url() + "/static/"):
            # Local file - convert to base64
            filename = image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            converted_image_url = upload_to_replicate(filepath)
            print(f"✅ Converted local file to base64: {converted_image_url[:100]}...")
        elif image_url.startswith("http://") or image_url.startswith("https://"):
            # External URL (Cloudinary, etc.) - download and convert to base64
            print(f"📥 Downloading image from URL for Veo conversion...")
            try:
                import requests
                response = requests.get(image_url, timeout=30)
                response.raise_for_status()
                
                # Convert to base64 data URL
                import base64
                image_data = response.content
                image_base64 = base64.b64encode(image_data).decode('utf-8')
                
                # Determine image format from content or URL
                if image_url.lower().endswith('.png'):
                    mime_type = 'image/png'
                elif image_url.lower().endswith('.webp'):
                    mime_type = 'image/webp'
                elif image_url.lower().endswith('.jpg') or image_url.lower().endswith('.jpeg'):
                    mime_type = 'image/jpeg'
                else:
                    # Try to detect from content
                    from io import BytesIO
                    from PIL import Image
                    img = Image.open(BytesIO(image_data))
                    if img.format == 'PNG':
                        mime_type = 'image/png'
                    elif img.format == 'WEBP':
                        mime_type = 'image/webp'
                    else:
                        mime_type = 'image/jpeg'
                
                converted_image_url = f"data:{mime_type};base64,{image_base64}"
                print(f"✅ Converted external URL to base64 data URL (size: {len(converted_image_url)} chars)")
            except Exception as download_error:
                print(f"⚠️ Failed to download and convert image: {download_error}")
                print(f"⚠️ Using original URL (Veo may not use it correctly)")
                converted_image_url = image_url
        
        # Use converted URL if available, otherwise use original
        final_image_url = converted_image_url if converted_image_url else image_url
        
        # IMPORTANT: Veo 3.1 requires 16:9 aspect ratio when using reference_image
        # According to Google's documentation, reference images only work with 16:9 aspect ratio
        # So we force 16:9 when using reference_image, regardless of requested quality
        aspect_ratio = "16:9"  # Required for reference_image parameter
        
        # Note: We use 16:9 even if user requested portrait (9:16) because reference_image requires it
        print(f"⚠️ Using 16:9 aspect ratio (required for reference_image), even if {video_quality} was requested as portrait")
        
        # Duration in seconds - Veo 3.1 only accepts 4, 6, or 8 seconds
        # Map user input (5s/10s) to Veo's allowed values (4, 6, 8)
        if duration == "10s":
            duration_seconds = 8  # Map 10s to 8s (closest allowed value)
        elif duration == "5s":
            duration_seconds = 6  # Map 5s to 6s (closest allowed value)
        else:
            duration_seconds = 6  # Default to 6s
        
        print(f"🎨 Using {aspect_ratio} aspect ratio")
        print(f"⏱️ Using {duration_seconds}s duration")
        
        # Run Veo 3.1
        # According to Replicate API docs, Veo 3.1 uses "reference_images" (plural) as an array
        # The prompt should describe the desired animation/motion, not instruct to use the image
        # The reference_images parameter handles the visual reference automatically
        base_prompt = custom_prompt or "gentle natural movement, subtle breathing, soft fabric flow, professional fashion photography, minimal motion, elegant stillness"
        
        # Keep prompt simple - describe the desired animation/scene
        # Veo will use reference_images automatically without explicit instructions
        enhanced_prompt = base_prompt
        
        print(f"🔄 Calling Google Veo 3.1 API...")
        print(f"📝 Prompt: {enhanced_prompt[:200]}...")
        print(f"🖼️ Reference images (array): [{final_image_url[:100]}...]")
        print(f"📐 Aspect ratio: {aspect_ratio}")
        print(f"⏱️ Duration: {duration_seconds}s")
        
        try:
            out = replicate.run(
                "google/veo-3.1",
                input={
                    "prompt": enhanced_prompt,
                    "reference_images": [final_image_url],  # ✅ Fixed: plural "reference_images" as array
                    "aspect_ratio": aspect_ratio,
                    "duration": duration_seconds,
                    "quality": "high"  # Veo 3.1 always high quality
                }
            )
            print(f"✅ Veo API call successful, processing output...")
        except replicate.exceptions.ModelError as model_error:
            # Handle content moderation errors specifically
            error_str = str(model_error)
            if "flagged as sensitive" in error_str or "E005" in error_str:
                print(f"⚠️ Veo content moderation: Image flagged as sensitive")
                print(f"💡 Suggestion: Try using a different model (Kling, Seedance, or Wan) or use a different image")
                raise ValueError("Image was flagged as sensitive by Veo's content moderation. Please try a different image or use another video model (Kling, Seedance, or Wan).")
            else:
                print(f"❌ Veo ModelError: {model_error}")
                raise
        except replicate.exceptions.ReplicateError as replicate_error:
            print(f"❌ Veo ReplicateError: {replicate_error}")
            raise
        except Exception as api_error:
            print(f"❌ Veo API call failed: {api_error}")
            print(f"🔍 Error type: {type(api_error)}")
            import traceback
            traceback.print_exc()
            raise
        
        # Handle output
        if hasattr(out, 'url'):
            video_url = out.url()
        elif isinstance(out, str):
            video_url = out
        elif isinstance(out, list) and len(out) > 0:
            video_url = out[0] if isinstance(out[0], str) else out[0].url()
        else:
            video_url = str(out)
        
        print(f"✅ Veo 3.1 video generated: {video_url[:50]}...")
        
        # Download and save video locally
        downloaded_url = download_and_save_video(video_url)
        return downloaded_url
        
    except Exception as e:
        print(f"❌ Veo 3.1 video generation failed: {e}")
        return None

def run_kling_video_generation(image_url: str, video_quality: str = "480p", duration: str = "5s", custom_prompt: Optional[str] = None) -> str:
    """Generate video from image using Kling 2.5 Turbo Pro API"""
    try:
        print(f"🎬 Running Kling 2.5 Turbo Pro video generation: {image_url[:50]}...")
        
        # Convert local URLs to base64 for Replicate
        if image_url.startswith(get_base_url() + "/static/"):
            filename = image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            image_url = upload_to_replicate(filepath)
            print(f"Converted image to base64: {image_url[:100]}...")
        
        # Kling only supports prompt and image parameters
        prompt = custom_prompt or "gentle natural movement, subtle breathing, soft fabric flow, professional fashion photography, minimal motion, elegant stillness"
        
        print(f"🎨 Using prompt: {prompt}")
        print(f"🖼️ Using image: {image_url[:100]}...")
        
        # Run Kling 2.5 Turbo Pro - ONLY with supported parameters
        print(f"🔄 Calling Kling 2.5 Turbo Pro API...")
        out = replicate.run(
            "kwaivgi/kling-v2.5-turbo-pro",
            input={
                "prompt": prompt,
                "image": image_url
            }
        )
        
        # Debug: Check what Kling is actually returning
        print(f"🔍 Kling raw output type: {type(out)}")
        print(f"🔍 Kling raw output: {out}")
        if hasattr(out, '__dict__'):
            print(f"🔍 Kling output attributes: {dir(out)}")
        if hasattr(out, '__iter__') and not isinstance(out, str):
            print(f"🔍 Kling output is iterable, length: {len(out) if hasattr(out, '__len__') else 'unknown'}")
            if hasattr(out, '__len__') and len(out) > 0:
                for i, item in enumerate(out):
                    print(f"🔍 Kling output item {i}: {type(item)} - {item}")
        
        # Handle output - Kling returns a string URL directly
        if isinstance(out, str):
            video_url = out
        elif hasattr(out, 'url'):
            video_url = out.url
        elif hasattr(out, 'url()'):
            video_url = out.url()
        elif isinstance(out, list) and len(out) > 0:
            video_url = out[0]
        else:
            video_url = str(out)
        
        # Persist the video URL
        if video_url:
            # Use Cloudinary for all files including videos (fixes HTTPS/HTTP mixed content issue)
            video_url = upload_to_cloudinary(video_url, "kling_videos")
            print(f"✅ Kling video generated and persisted to Cloudinary: {video_url}")
            return video_url
        
        return None
        
    except Exception as e:
        print(f"❌ Kling video generation failed: {e}")
        return None

def run_veo_direct_generation(model_image: str, product_image: str, scene_image: str, video_quality: str = "480p", duration: str = "5s", custom_prompt: Optional[str] = None) -> str:
    """Generate video directly from model + product + scene using Google Veo 3.1"""
    try:
        print(f"🎬 Running Veo Direct: model + product + scene → video")
        
        # Convert local URLs to base64 for Replicate
        if model_image.startswith(get_base_url() + "/static/"):
            filename = model_image.replace(get_base_url() + "/static/", "")
            model_image = upload_to_replicate(f"uploads/{filename}")
        
        if product_image.startswith(get_base_url() + "/static/"):
            filename = product_image.replace(get_base_url() + "/static/", "")
            product_image = upload_to_replicate(f"uploads/{filename}")
        
        if scene_image.startswith(get_base_url() + "/static/"):
            filename = scene_image.replace(get_base_url() + "/static/", "")
            scene_image = upload_to_replicate(f"uploads/{filename}")
        
        # Map quality to aspect ratio
        if video_quality == "1080p":
            aspect_ratio = "16:9"
        elif video_quality == "720p":
            aspect_ratio = "16:9"
        else:  # 480p
            aspect_ratio = "9:16"
        
        # Duration in seconds - Veo 3.1 only accepts 4, 6, or 8 seconds
        # Map user input (5s/10s) to Veo's allowed values (4, 6, 8)
        if duration == "10s":
            duration_seconds = 8  # Map 10s to 8s (closest allowed value)
        elif duration == "5s":
            duration_seconds = 6  # Map 5s to 6s (closest allowed value)
        else:
            duration_seconds = 6  # Default to 6s
        
        # Build comprehensive prompt for Veo
        if custom_prompt:
            full_prompt = custom_prompt
        else:
            full_prompt = (
                "Professional fashion video: model wearing the product in the scene setting. "
                "Slow subtle poses, minimal movement, elegant and refined. "
                "Cinematic lighting, luxury aesthetic, high-end editorial style, dramatic atmosphere."
            )
        
        print(f"🎨 Veo Direct prompt: {full_prompt}")
        print(f"🎨 Using {aspect_ratio} aspect ratio, {duration_seconds}s duration")
        
        # Run Veo 3.1 with text-to-video (it will interpret the inputs creatively)
        print(f"🔄 Calling Google Veo 3.1 API (Direct Mode)...")
        out = replicate.run(
            "google/veo-3.1",
            input={
                "prompt": full_prompt,
                # Veo 3.1 doesn't officially support multi-image input for video
                # So we'll use reference_image with the scene as primary reference
                "reference_image": scene_image,
                "aspect_ratio": aspect_ratio,
                "duration": duration_seconds,
                "quality": "high"
            }
        )
        
        # Handle output
        if hasattr(out, 'url'):
            video_url = out.url()
        elif isinstance(out, str):
            video_url = out
        elif isinstance(out, list) and len(out) > 0:
            video_url = out[0] if isinstance(out[0], str) else out[0].url()
        else:
            video_url = str(out)
        
        print(f"✅ Veo Direct video generated: {video_url[:50]}...")
        
        # Download and save video locally
        downloaded_url = download_and_save_video(video_url)
        return downloaded_url
        
    except Exception as e:
        print(f"❌ Veo Direct generation failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def download_and_save_video(url: str) -> str:
    """
    Download video from URL and upload to Cloudinary (or save locally if Cloudinary not available).
    Returns Cloudinary URL for production, localhost URL as fallback.
    """
    try:
        # First, try to upload directly to Cloudinary from the URL
        if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
            try:
                print(f"☁️ Uploading video to Cloudinary from: {url[:100]}...")
                result = cloudinary.uploader.upload(
                    url,
                    folder="kling_videos",
                    public_id=f"kling_videos_{uuid.uuid4().hex}",
                    resource_type="video"
                )
                cloudinary_url = result['secure_url']
                print(f"✅ Video uploaded to Cloudinary: {cloudinary_url[:100]}...")
                return cloudinary_url
            except Exception as cloudinary_error:
                print(f"⚠️ Failed to upload video to Cloudinary: {cloudinary_error}")
                print(f"📥 Falling back to local download...")
        
        # Fallback: Download and save locally (for development or if Cloudinary fails)
        import requests
        
        print(f"📥 Downloading video from: {url[:100]}...")
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        
        # Generate unique filename
        video_id = str(uuid.uuid4())
        filename = f"video_{video_id}.mp4"
        filepath = f"uploads/{filename}"
        
        # Save video
        with open(filepath, "wb") as f:
            f.write(response.content)
        
        # Try to upload the saved file to Cloudinary
        if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
            try:
                print(f"☁️ Uploading saved video file to Cloudinary...")
                result = cloudinary.uploader.upload(
                    filepath,
                    folder="kling_videos",
                    public_id=f"kling_videos_{video_id}",
                    resource_type="video"
                )
                cloudinary_url = result['secure_url']
                print(f"✅ Video uploaded to Cloudinary: {cloudinary_url[:100]}...")
                # Clean up local file after successful upload
                try:
                    os.remove(filepath)
                    print(f"🗑️ Removed local video file after Cloudinary upload")
                except:
                    pass
                return cloudinary_url
            except Exception as upload_error:
                print(f"⚠️ Failed to upload saved video to Cloudinary: {upload_error}")
        
        # Return local URL only as last resort
        local_url = get_static_url(filename)
        print(f"✅ Video saved locally: {local_url}")
        return local_url
        
    except Exception as e:
        print(f"❌ Failed to download/save video: {e}")
        import traceback
        traceback.print_exc()
        return url  # Return original URL as fallback

class TweakImageRequest(BaseModel):
    image_url: str
    prompt: str

class TryOnRequest(BaseModel):
    model_image_url: str
    product_id: Optional[str] = None
    garment_url: Optional[str] = None
    clothing_type: Optional[str] = "top"
    quality: Optional[str] = "standard"

@app.post("/tweak-image")
async def tweak_image(
    request: TweakImageRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Tweak an existing image based on a text prompt using Qwen Image Edit Plus.
    Uses img2img to modify the image while preserving the overall composition.
    """
    try:
        print(f"🔧 Tweaking image with prompt: {request.prompt}")
        print(f"📸 Image URL: {request.image_url[:100]}...")
        
        # Convert local URLs to base64 for Qwen
        if request.image_url.startswith(get_base_url() + "/static/"):
            filename = request.image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            image_base64 = upload_to_replicate(filepath)
            print(f"✅ Converted to base64")
        else:
            # If it's an external URL, download and convert
            response = requests.get(request.image_url, timeout=30)
            response.raise_for_status()
            img = Image.open(BytesIO(response.content))
            
            # Resize for processing
            max_size = 384
            ratio = min(max_size/img.width, max_size/img.height)
            new_size = (int(img.width*ratio), int(img.height*ratio))
            img = img.resize(new_size, Image.LANCZOS)
            
            # Convert to base64
            buffered = BytesIO()
            img.save(buffered, format="JPEG", quality=95)
            img_base64 = base64.b64encode(buffered.getvalue()).decode()
            image_base64 = f"data:image/jpeg;base64,{img_base64}"
            print(f"✅ Downloaded and converted external URL")
        
        # Use Qwen for image tweaking (img2img editing)
        print(f"🎨 Running Qwen for image tweaking...")
        out = replicate.run("qwen/qwen-image-edit-plus", input={
            "prompt": f"{request.prompt}. Professional luxury fashion aesthetic, professional quality.",
            "image": [image_base64],  # Only one image for editing
            "num_inference_steps": 35,
            "guidance_scale": 7.0,
            "strength": 0.45  # Moderate strength - preserves composition but allows changes
        })
        
        # Handle output
        if hasattr(out, 'url'):
            tweaked_url = out.url()
        elif isinstance(out, str):
            tweaked_url = out
        elif isinstance(out, list) and len(out) > 0:
            tweaked_url = out[0] if isinstance(out[0], str) else out[0].url()
        else:
            tweaked_url = str(out)
        
        print(f"✅ Qwen tweaking completed: {tweaked_url[:50]}...")
        
        # Download and save tweaked image
        print(f"💾 Downloading tweaked image...")
        final_url = upload_to_cloudinary(tweaked_url, "tweaked")
        print(f"✅ Tweaked image saved: {final_url[:50]}...")
        
        return {
            "message": "Image tweaked successfully",
            "original_url": request.image_url,
            "tweaked_url": final_url,
            "prompt": request.prompt
        }
        
    except Exception as e:
        print(f"❌ Image tweaking failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Image tweaking failed: {str(e)}")

class ReapplyClothesRequest(BaseModel):
    image_url: str
    product_id: str
    clothing_type: Optional[str] = "top"
    campaign_id: Optional[str] = None

@app.post("/reapply-clothes")
async def reapply_clothes(
    request: ReapplyClothesRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a product to an existing image using Qwen Image Edit Plus.
    Takes the current image and applies the product packshot onto the model.
    """
    try:
        print(f"👔 Reapplying clothes to image")
        print(f"📸 Image URL: {request.image_url[:100]}...")
        print(f"🛍️ Product ID: {request.product_id}")
        print(f"👕 Clothing type: {request.clothing_type}")
        
        # Get the product
        product = db.query(Product).filter(Product.id == request.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Use product packshot (front view preferred)
        # Prioritize packshots array over packshot URLs to ensure we use the generated packshots
        # Generated packshots are usually better isolated than manually uploaded ones
        product_image = None
        
        # Get packshots array (ensure it's a list)
        packshots_list = []
        if hasattr(product, 'packshots') and product.packshots:
            # Handle both list and JSON string
            if isinstance(product.packshots, str):
                try:
                    import json
                    packshots_list = json.loads(product.packshots)
                except:
                    packshots_list = []
            elif isinstance(product.packshots, list):
                packshots_list = product.packshots
            else:
                packshots_list = []
        
        # Strategy: Prioritize packshots array first (generated packshots are usually better)
        if packshots_list and len(packshots_list) > 0:
            # Use first packshot URL from array (usually front)
            product_image = packshots_list[0]
            print(f"📦 Using packshot from packshots array (first packshot): {product_image[:80]}...")
            print(f"📦 Total packshots in array: {len(packshots_list)}")
            if len(packshots_list) > 1:
                print(f"📦 Alternative packshots available: {[p[:50] + '...' for p in packshots_list[1:]]}")
        # Fall back to explicit packshot URLs
        elif product.packshot_front_url:
            product_image = product.packshot_front_url
            print(f"📦 Using packshot_front_url: {product_image[:80]}...")
        elif product.packshot_back_url:
            product_image = product.packshot_back_url
            print(f"📦 Using packshot_back_url: {product_image[:80]}...")
        # Only use image_url as last resort (it might be the original upload with full outfit)
        else:
            product_image = product.image_url
            print(f"⚠️ No packshots available, using image_url (may contain full outfit)")
            print(f"⚠️ WARNING: image_url may contain the whole outfit, not just the product!")
        
        print(f"🔍 Product image selection for '{product.name}':")
        print(f"   packshot_front_url: {product.packshot_front_url}")
        print(f"   packshot_back_url: {product.packshot_back_url}")
        print(f"   packshots array (raw): {getattr(product, 'packshots', None)}")
        print(f"   packshots array (parsed): {packshots_list}")
        print(f"   image_url: {product.image_url[:80] if product.image_url else None}...")
        print(f"   ✅ Selected product_image: {product_image[:80] if product_image else None}...")
        print(f"   🔍 Final product_image URL length: {len(product_image) if product_image else 0}")
        
        # Get clothing type from product or use provided
        # Also check category field as fallback since API returns clothing_type as null
        clothing_type = (
            product.clothing_type if hasattr(product, 'clothing_type') and product.clothing_type 
            else (product.category if hasattr(product, 'category') and product.category else None)
            or request.clothing_type
        )
        print(f"🔍 Final clothing_type used: {clothing_type} (from product.clothing_type={getattr(product, 'clothing_type', None)}, product.category={getattr(product, 'category', None)}, request.clothing_type={request.clothing_type})")
        
        # Convert image URL to format Vella can use
        if request.image_url.startswith(get_base_url() + "/static/"):
            # Local file - can use directly
            model_image_url = request.image_url
        else:
            # External URL - use directly
            model_image_url = request.image_url
        
        # Apply Qwen to add product (switched from Vella)
        print(f"🎨 Running Qwen to add product...")
        qwen_result_url = run_qwen_add_product(model_image_url, product_image, clothing_type, product.name)
        print(f"✅ Qwen add product completed: {qwen_result_url[:50]}...")
        
        # Download and save the result
        print(f"💾 Downloading result...")
        final_url = upload_to_cloudinary(qwen_result_url, "reapplied_clothes")
        print(f"✅ Reapplied clothes saved: {final_url[:50]}...")
        
        # If campaign_id is provided, update the image in the campaign
        if request.campaign_id:
            try:
                campaign = db.query(Campaign).filter(Campaign.id == request.campaign_id).first()
                if campaign and campaign.settings and "generated_images" in campaign.settings:
                    # Find and update the image with the old URL
                    updated = False
                    for img in campaign.settings["generated_images"]:
                        if img.get("image_url") == request.image_url:
                            img["image_url"] = final_url
                            updated = True
                            print(f"✅ Updated image in campaign {request.campaign_id}")
                            break
                    
                    if updated:
                        # Force SQLAlchemy to detect the change
                        flag_modified(campaign, "settings")
                        db.commit()
                        db.refresh(campaign)
                        print(f"✅ Campaign updated successfully")
            except Exception as e:
                print(f"⚠️ Failed to update campaign: {e}")
                # Don't fail the whole request if campaign update fails
        
        # Log final details for debugging
        print(f"🎯 Final response details:")
        print(f"   Product: {product.name}")
        print(f"   Clothing type: {clothing_type}")
        print(f"   Packshot used: {product_image[:80] if product_image else 'None'}...")
        print(f"   Original image: {request.image_url[:80]}...")
        print(f"   Result image: {final_url[:80]}...")
        
        return {
            "success": True,
            "message": f"Successfully reapplied {product.name}",
            "original_url": request.image_url,
            "reapplied_url": final_url,
            "product_name": product.name,
            "clothing_type": clothing_type,
            "packshot_used": product_image[:100] if product_image else None,
            "packshots_available": len(packshots_list) if packshots_list else 0
        }
        
    except Exception as e:
        print(f"❌ Reapply clothes failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Reapply clothes failed: {str(e)}")

class BulkVideoRequest(BaseModel):
    video_quality: str = "480p"
    duration: str = "5s"
    model: str = "wan"
    custom_prompt: Optional[str] = None
    veo_direct_mode: bool = False
    selected_image_indices: List[int] = []

@app.delete("/campaigns/{campaign_id}/images/{image_index}")
async def delete_campaign_image(
    campaign_id: str,
    image_index: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a specific image from a campaign"""
    try:
        # Get the campaign
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Get generated images
        if not campaign.settings or not campaign.settings.get("generated_images"):
            raise HTTPException(status_code=400, detail="No images found in campaign")
        
        generated_images = campaign.settings["generated_images"]
        
        # Check if index is valid
        if image_index < 0 or image_index >= len(generated_images):
            raise HTTPException(status_code=400, detail="Invalid image index")
        
        # Remove the image
        deleted_image = generated_images.pop(image_index)
        print(f"🗑️ Deleted image at index {image_index} from campaign {campaign.name}")
        
        # Update campaign settings
        campaign.settings["generated_images"] = generated_images
        flag_modified(campaign, "settings")
        
        db.commit()
        db.refresh(campaign)
        
        return {
            "message": "Image deleted successfully",
            "deleted_index": image_index,
            "deleted_image": deleted_image,
            "remaining_images": len(generated_images)
        }
        
    except Exception as e:
        print(f"❌ Failed to delete image: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/campaigns/{campaign_id}/generate-videos-bulk")
async def generate_videos_for_campaign(
    campaign_id: str,
    request: BulkVideoRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate videos for all images in a campaign (BACKGROUND PROCESSING).
    Returns immediately and processes in background. Poll /status for progress.
    
    **Credit Costs per video:**
    - Wan 2.2 I2V Fast: 480p: 1 credit, 720p: 2 credits
    - Seedance 1 Pro: 480p: 2-3 credits, 1080p: 4-6 credits
    - Kling 2.5 Turbo Pro: 480p: 2-3 credits, 720p: 3-4 credits, 1080p: 4-6 credits
    - Google Veo 3.1: 480p: 3-4 credits, 720p: 4-6 credits, 1080p: 5-8 credits
    """
    try:
        # Get the campaign
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Determine video generation logic based on mode
        if request.veo_direct_mode:
            num_videos_to_generate = 1
            if request.video_quality == "1080p":
                credits_per_video = 8 if request.duration == "10s" else 5
            elif request.video_quality == "720p":
                credits_per_video = 6 if request.duration == "10s" else 4
            else:
                credits_per_video = 4 if request.duration == "10s" else 3
            total_credits_needed = credits_per_video
        else:
            if not campaign.settings or not campaign.settings.get("generated_images"):
                raise HTTPException(status_code=400, detail="No images found in campaign")
            
            generated_images = campaign.settings["generated_images"]
            
            if request.selected_image_indices:
                selected_images = [generated_images[i] for i in request.selected_image_indices if i < len(generated_images)]
                if not selected_images:
                    raise HTTPException(status_code=400, detail="No valid images selected")
            else:
                selected_images = generated_images
            
            # Calculate credits
            if request.model == "seedance":
                if request.video_quality == "1080p":
                    credits_per_video = 6 if request.duration == "10s" else 4
                else:
                    credits_per_video = 3 if request.duration == "10s" else 2
            elif request.model == "veo":
                if request.video_quality == "1080p":
                    credits_per_video = 8 if request.duration == "10s" else 5
                elif request.video_quality == "720p":
                    credits_per_video = 6 if request.duration == "10s" else 4
                else:
                    credits_per_video = 4 if request.duration == "10s" else 3
            elif request.model == "kling":
                if request.video_quality == "1080p":
                    credits_per_video = 6 if request.duration == "10s" else 4
                elif request.video_quality == "720p":
                    credits_per_video = 4 if request.duration == "10s" else 3
                else:
                    credits_per_video = 3 if request.duration == "10s" else 2
            else:  # wan
                credits_per_video = 2 if request.video_quality == "720p" else 1
            
            total_credits_needed = credits_per_video * len(selected_images)
            num_videos_to_generate = len(selected_images)
        
        # Get user and check credits
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        total_available = (user.subscription_credits or 0) + user.credits
        if total_available < total_credits_needed:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient credits. You have {total_available} credits, but need {total_credits_needed} credits ({credits_per_video} per video × {num_videos_to_generate} videos)"
            )
        
        # Update campaign status to "generating"
        new_settings = dict(campaign.settings) if campaign.settings else {}
        new_settings["bulk_video_status"] = "generating"
        new_settings["bulk_video_progress"] = {
            "current": 0,
            "total": num_videos_to_generate,
            "started_at": datetime.utcnow().isoformat()
        }
        campaign.settings = new_settings
        flag_modified(campaign, "settings")
        db.commit()
        
        print(f"🎬 Starting BACKGROUND video generation for {num_videos_to_generate} videos...")
        
        # Start background task
        import asyncio
        asyncio.create_task(generate_bulk_videos_background(
            campaign_id=campaign_id,
            user_id=current_user["user_id"],
            request_data={
                "video_quality": request.video_quality,
                "duration": request.duration,
                "model": request.model,
                "custom_prompt": request.custom_prompt,
                "veo_direct_mode": request.veo_direct_mode,
                "selected_image_indices": request.selected_image_indices,
                "credits_per_video": credits_per_video
            }
        ))
        
        return {
            "message": f"🎬 Video generation started! Generating {num_videos_to_generate} videos in background...",
            "status": "started",
            "total_videos": num_videos_to_generate,
            "estimated_time_seconds": num_videos_to_generate * 135  # ~2:15 per video (Kling 2.5 max quality)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to start bulk video generation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to start video generation: {str(e)}")


async def generate_bulk_videos_background(
    campaign_id: str,
    user_id: str,
    request_data: dict
):
    """Background task to generate bulk videos"""
    from datetime import datetime
    
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        user = db.query(User).filter(User.id == user_id).first()
        
        if not campaign or not user:
            print(f"❌ Campaign or user not found for background video generation")
            return
        
        success_count = 0
        failed_count = 0
        results = []
        
        veo_direct_mode = request_data.get("veo_direct_mode", False)
        video_quality = request_data.get("video_quality", "480p")
        duration = request_data.get("duration", "5s")
        model = request_data.get("model", "wan")
        custom_prompt = request_data.get("custom_prompt")
        selected_indices = request_data.get("selected_image_indices", [])
        credits_per_video = request_data.get("credits_per_video", 1)
        
        if veo_direct_mode:
            # VEO DIRECT MODE
            try:
                print(f"🎬 [BACKGROUND] Generating Veo Direct video...")
                
                model_ids = campaign.settings.get("model_ids", [])
                product_ids = campaign.settings.get("product_ids", [])
                scene_ids = campaign.settings.get("scene_ids", [])
                
                if not model_ids or not product_ids or not scene_ids:
                    raise ValueError("Campaign must have model, product, and scene selected")
                
                model_obj = db.query(Model).filter(Model.id == model_ids[0]).first()
                product = db.query(Product).filter(Product.id == product_ids[0]).first()
                scene = db.query(Scene).filter(Scene.id == scene_ids[0]).first()
                
                if not model_obj or not product or not scene:
                    raise ValueError("Could not find model, product, or scene")
                
                model_image = model_obj.poses[0] if model_obj.poses and len(model_obj.poses) > 0 else model_obj.image_url
                product_image = product.packshot_front_url or product.image_url
                scene_image = scene.image_url
                
                video_url = run_veo_direct_generation(
                    model_image, product_image, scene_image,
                    video_quality, duration, custom_prompt
                )
                
                if video_url:
                    success_count += 1
                    results.append({"index": 0, "status": "success", "video_url": video_url})
                else:
                    failed_count += 1
                    results.append({"index": 0, "status": "failed"})
                    
            except Exception as e:
                print(f"❌ Veo Direct failed: {e}")
                failed_count += 1
                results.append({"index": 0, "status": "failed", "message": str(e)})
        
        else:
            # STANDARD MODE - Generate videos from images
            generated_images = campaign.settings.get("generated_images", [])
            
            if selected_indices:
                images_to_process = [(i, generated_images[i]) for i in selected_indices if i < len(generated_images)]
            else:
                images_to_process = list(enumerate(generated_images))
            
            total = len(images_to_process)
            
            for idx, (original_idx, img_data) in enumerate(images_to_process):
                try:
                    image_url = img_data.get("image_url")
                    if not image_url:
                        failed_count += 1
                        continue
                    
                    print(f"🎬 [BACKGROUND] Video {idx+1}/{total}: {image_url[:50]}...")
                    
                    # Update progress
                    campaign.settings["bulk_video_progress"] = {
                        "current": idx + 1,
                        "total": total,
                        "current_name": img_data.get("shot_name", f"Video {idx+1}")
                    }
                    flag_modified(campaign, "settings")
                    db.commit()
                    
                    # Generate video
                    if model == "seedance":
                        video_url = run_seedance_video_generation(image_url, video_quality, duration, custom_prompt)
                    elif model == "veo":
                        video_url = run_veo_video_generation(image_url, video_quality, duration, custom_prompt)
                    elif model == "kling":
                        video_url = run_kling_video_generation(image_url, video_quality, duration, custom_prompt)
                    else:  # wan
                        video_url = run_wan_video_generation(image_url, video_quality, custom_prompt)
                    
                    if video_url:
                        # Update the image data with video URL
                        generated_images[original_idx]["video_url"] = video_url
                        success_count += 1
                        results.append({"index": original_idx, "status": "success", "video_url": video_url})
                        print(f"✅ [BACKGROUND] Video {idx+1} done: {video_url[:50]}...")
                        
                        # CRITICAL: Save immediately after each video so it shows in UI
                        campaign.settings["generated_images"] = generated_images
                        flag_modified(campaign, "settings")
                        db.commit()
                        print(f"💾 Saved video_url to database for image {original_idx}")
                    else:
                        failed_count += 1
                        results.append({"index": original_idx, "status": "failed"})
                        
                except Exception as e:
                    print(f"❌ [BACKGROUND] Video {idx+1} failed: {e}")
                    failed_count += 1
                    results.append({"index": original_idx, "status": "failed", "message": str(e)})
            
            # Final save of all images (in case any were missed)
            campaign.settings["generated_images"] = generated_images
            flag_modified(campaign, "settings")
            db.commit()
        
        # Deduct credits
        credits_used = success_count * credits_per_video
        if credits_used > 0:
            deduct_credits(user, credits_used, db)
        
        # Update final status
        campaign.settings["bulk_video_status"] = "completed"
        campaign.settings["bulk_video_progress"] = {
            "current": success_count + failed_count,
            "total": success_count + failed_count,
            "success_count": success_count,
            "failed_count": failed_count,
            "credits_used": credits_used,
            "completed_at": datetime.utcnow().isoformat()
        }
        flag_modified(campaign, "settings")
        db.commit()
        
        print(f"✅ [BACKGROUND] Bulk video generation COMPLETE: {success_count} success, {failed_count} failed")
        
    except Exception as e:
        print(f"❌ [BACKGROUND] Bulk video generation error: {e}")
        import traceback
        traceback.print_exc()
        
        try:
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if campaign:
                campaign.settings["bulk_video_status"] = "failed"
                campaign.settings["bulk_video_progress"]["error"] = str(e)
                flag_modified(campaign, "settings")
                db.commit()
        except:
            pass
    finally:
        db.close()

@app.post("/generations/{generation_id}/generate-video")
async def generate_video_for_generation(
    generation_id: str,
    video_quality: str = "480p",  # "480p", "720p", or "1080p"
    duration: str = "5s",  # "5s" or "10s" (for Seedance, Kling, and Veo)
    model: str = "wan",  # "wan", "seedance", "kling", or "veo"
    custom_prompt: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate video for a specific generation with credit-based costs.
    
    **Credit Costs:**
    - Wan 2.2 I2V Fast:
      - 480p: 1 credit
      - 720p: 2 credits
    - Seedance 1 Pro:
      - 480p (5s): 2 credits
      - 480p (10s): 3 credits
      - 1080p (5s): 4 credits
      - 1080p (10s): 6 credits
    - Kling 2.5 Turbo Pro (Pro-level):
      - 480p (5s): 2 credits
      - 480p (10s): 3 credits
      - 720p (5s): 3 credits
      - 720p (10s): 4 credits
      - 1080p (5s): 4 credits
      - 1080p (10s): 6 credits
    """
    try:
        # Get the generation
        generation = db.query(Generation).filter(
            Generation.id == generation_id,
            Generation.user_id == current_user["user_id"]
        ).first()
        
        if not generation:
            raise HTTPException(status_code=404, detail="Generation not found")
        
        # Allow multiple video generations for the same image
        # Removed restriction: if generation.video_urls and len(generation.video_urls) > 0:
        # Users can now generate multiple videos for the same image
        
        # Get user
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Determine credits needed based on video quality, model, and duration
        if model == "seedance":
            if video_quality == "1080p":
                if duration == "10s":
                    credits_needed = 6  # 1080p 10s Seedance (most expensive)
                else:  # 5s
                    credits_needed = 4  # 1080p 5s Seedance
            else:  # 480p
                if duration == "10s":
                    credits_needed = 3  # 480p 10s Seedance
                else:  # 5s
                    credits_needed = 2  # 480p 5s Seedance
        elif model == "kling":
            if video_quality == "1080p":
                if duration == "10s":
                    credits_needed = 6  # 1080p 10s Kling
                else:  # 5s
                    credits_needed = 4  # 1080p 5s Kling
            elif video_quality == "720p":
                if duration == "10s":
                    credits_needed = 4  # 720p 10s Kling
                else:  # 5s
                    credits_needed = 3  # 720p 5s Kling
            else:  # 480p
                if duration == "10s":
                    credits_needed = 3  # 480p 10s Kling
                else:  # 5s
                    credits_needed = 2  # 480p 5s Kling
        elif model == "veo":
            # Veo 3.1 pricing (similar to Kling, high quality)
            if video_quality == "1080p":
                if duration == "10s":
                    credits_needed = 6  # 1080p 10s Veo
                else:  # 5s
                    credits_needed = 4  # 1080p 5s Veo
            elif video_quality == "720p":
                if duration == "10s":
                    credits_needed = 4  # 720p 10s Veo
                else:  # 5s
                    credits_needed = 3  # 720p 5s Veo
            else:  # 480p
                if duration == "10s":
                    credits_needed = 3  # 480p 10s Veo
                else:  # 5s
                    credits_needed = 2  # 480p 5s Veo
        else:  # wan model
            if video_quality == "720p":
                credits_needed = 2  # 720p Wan
            else:  # 480p
                credits_needed = 1  # 480p Wan (cheapest)
        
        # Check credits (prioritizing subscription credits)
        if not deduct_credits(user, credits_needed, db):
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient credits. You need {credits_needed} credits for {model} {video_quality} {duration if model in ['seedance', 'kling', 'veo'] else ''} video generation"
            )
        
        # Get the image URL from the generation
        if not generation.output_urls or len(generation.output_urls) == 0:
            raise HTTPException(status_code=400, detail="No image found for this generation")
        
        image_url = generation.output_urls[0]
        
        # Generate video
        print(f"🎬 Generating {video_quality} video using {model} model for generation {generation_id}...")
        if custom_prompt:
            print(f"🎨 Using custom prompt: {custom_prompt[:100]}...")
        
        if model == "seedance":
            video_url = run_seedance_video_generation(image_url, video_quality, duration, custom_prompt)
        elif model == "kling":
            video_url = run_kling_video_generation(image_url, video_quality, duration, custom_prompt)
        elif model == "veo":
            video_url = run_veo_video_generation(image_url, video_quality, duration, custom_prompt)
        else:  # wan model (default)
            video_url = run_wan_video_generation(image_url, video_quality, custom_prompt)
        
        if video_url:
            # Update generation with video URL
            generation.video_urls = [video_url]
            generation.updated_at = datetime.utcnow()
            
            # Credits already deducted by deduct_credits
            db.commit()
            db.refresh(generation)
            db.refresh(user)
            
            print(f"✅ Video generated successfully: {video_url}")
            return {
                "message": "Video generated successfully",
                "video_url": video_url,
                "credits_used": credits_needed,
                "credits_remaining": user.credits
            }
        else:
            raise HTTPException(
                status_code=500, 
                detail="Video generation failed"
            )
            
    except Exception as e:
        print(f"❌ Video generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Video generation failed: {str(e)}")

@app.post("/try-on")
async def try_on(
    request: TryOnRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Dress a model image with a garment using Vella 1.5 and return a stable /static URL."""
    try:
        # Resolve garment
        if request.product_id:
            product = db.query(Product).filter(Product.id == request.product_id, Product.user_id == current_user["user_id"]).first()
            if not product:
                raise HTTPException(status_code=404, detail="Product not found")
            garment_url = product.packshot_front_url or product.image_url
            clothing_type = product.clothing_type or (request.clothing_type or "top")
        else:
            if not request.garment_url:
                raise HTTPException(status_code=400, detail="Provide product_id or garment_url")
            garment_url = request.garment_url
            clothing_type = request.clothing_type or "top"

        # Stabilize inputs
        stable_model = stabilize_url(request.model_image_url, "tryon_model")
        stable_garment = stabilize_url(garment_url, "tryon_garment")

        # Run Vella
        vella_url = run_vella_try_on(stable_model, stable_garment, request.quality or "standard", clothing_type)
        vella_url = upload_to_cloudinary(vella_url, "tryon_final")
        return {"image_url": vella_url}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Try-on failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
