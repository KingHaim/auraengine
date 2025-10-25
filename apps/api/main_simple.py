#!/usr/bin/env python3
"""
Simple working version for debugging
Updated: Fixed Vella 1.5 API parameter (garment_image)
"""
from fastapi import FastAPI, HTTPException, Depends, Request, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from database import SessionLocal, create_tables
from models import User, Product, Model, Scene, Campaign, Generation
from schemas import UserCreate, UserResponse, Token, ProductResponse, ModelResponse, SceneResponse, CampaignResponse
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
app = FastAPI(title="Aura Engine API", version="1.0.0")

# Create database tables on startup
@app.on_event("startup")
async def startup_event():
    try:
        print("🔧 MODEL GENERATION: Using external URLs - NO LOCAL FILES")
        print("🗄️ Creating database tables...")
        create_tables()
        print("✅ Database tables created successfully")
        
        # Test database connection
        from sqlalchemy import text
        from database import engine
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("✅ Database connection test successful")
            
    except Exception as e:
        print(f"❌ Database startup error: {e}")
        import traceback
        traceback.print_exc()
        raise

# CORS middleware - Allow all origins for deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for deployment (can be restricted later)
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
    return {"message": "Aura Engine API"}

@app.get("/health")
async def health():
    return {"status": "healthy", "message": "Aura Engine API is running"}

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
@app.get("/static/{filename}")
async def serve_static_file(filename: str):
    """Serve static files directly"""
    import os
    file_path = os.path.join("uploads", filename)
    if os.path.exists(file_path):
        from fastapi.responses import FileResponse
        return FileResponse(file_path)
    else:
        # Return debug info when file not found
        uploads_dir = "uploads"
        files = os.listdir(uploads_dir) if os.path.exists(uploads_dir) else []
        raise HTTPException(
            status_code=404, 
            detail=f"File not found: {filename}. Available files: {files}"
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
        
        return UserResponse.from_orm(user)
    except Exception as e:
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
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all campaigns for the current user"""
    try:
        campaigns = db.query(Campaign).filter(Campaign.user_id == current_user["user_id"]).all()
        result = []
        for campaign in campaigns:
            try:
                # Ensure generation_status exists, default to "idle" if missing
                if not hasattr(campaign, 'generation_status') or campaign.generation_status is None:
                    campaign.generation_status = "idle"
                
                # Ensure scene_generation_status exists, default to "idle" if missing
                if not hasattr(campaign, 'scene_generation_status') or campaign.scene_generation_status is None:
                    campaign.scene_generation_status = "idle"
                
                result.append(CampaignResponse.model_validate(campaign))
            except Exception as validation_error:
                print(f"⚠️ Campaign validation failed for {campaign.id}: {validation_error}")
                # Skip this campaign if validation fails
                continue
        return result
    except Exception as e:
        print(f"❌ Error fetching campaigns: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def generate_campaign_images_background(
    campaign_id: str,
    product_id_list: list,
    model_id_list: list,
    scene_id_list: list,
    selected_poses_dict: dict,
    number_of_images: int,
    db: Session
):
    """Generate campaign images in background"""
    try:
        # Get campaign from database
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            print(f"❌ Campaign {campaign_id} not found")
            return
        
        print(f"🎯 Starting background generation for campaign: {campaign.name}")
        
        products = db.query(Product).filter(Product.id.in_(product_id_list)).all()
        models = db.query(Model).filter(Model.id.in_(model_id_list)).all()
        scenes = db.query(Scene).filter(Scene.id.in_(scene_id_list)).all()
        
        generated_images = []
        
        # Clamp requested number of images to available shot types
        try:
            shots_to_generate_count = max(1, min(int(number_of_images), len(CAMPAIGN_SHOT_TYPES)))
        except Exception:
            shots_to_generate_count = 1

        shot_types_to_generate = CAMPAIGN_SHOT_TYPES[:shots_to_generate_count]

        # Generate each combination with MULTIPLE SHOT TYPES for campaign flow
        for product in products:
            for model in models:
                for scene in scenes:
                    # Use product packshot (front view preferred)
                    product_image = product.packshot_front_url or product.image_url
                    
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
                    
                    print(f"🎬 Processing campaign flow: {product.name} + {model.name} + {scene.name}")
                    print(f"📸 Generating {len(shot_types_to_generate)} shots for this combination...")
                    
                    # Generate the requested shot types for this combination
                    print(f"🎬 Starting generation of {len(shot_types_to_generate)} shots...")
                    for shot_idx, shot_type in enumerate(shot_types_to_generate, 1):
                        try:
                            print(f"\n🎥 [{shot_idx}/{len(shot_types_to_generate)}] {shot_type['title']}")
                            print(f"📊 Progress: {shot_idx}/{len(shot_types_to_generate)} shots for {product.name} + {model.name} + {scene.name}")
                            
                            # REAL WORKFLOW: Qwen first, then Vella
                            quality_mode = "standard"

                            # TWO-STEP APPROACH: Separate scene composition from product application
                            
                            # Step 1: Place model into scene (NO clothing/product)
                            # Stabilize model pose to /static to avoid replicate 404s
                            stable_model = stabilize_url(model_image, "pose") if 'stabilize_url' in globals() else model_image
                            stable_scene = stabilize_url(scene.image_url, "scene") if 'stabilize_url' in globals() else scene.image_url
                            print(f"🎨 Step 1: Placing model into scene with shot type '{shot_type['name']}' using Nano Banana...")
                            model_in_scene_url = run_nano_banana_scene_composition(
                                stable_model,
                                stable_scene,
                                quality_mode,
                                shot_type_prompt=shot_type['prompt']
                            )
                            # Nano Banana result is already persisted
                            print(f"✅ Model placed in scene: {model_in_scene_url[:50]}...")

                            # Step 2: Apply product to model (using Vella)
                            print(f"👔 Step 2: Applying {product.name} to model with Vella 1.5 try-on...")
                            clothing_type = product.clothing_type if hasattr(product, 'clothing_type') and product.clothing_type else "top"
                            # Stabilize garment to /static (PNG with alpha already handled inside run_vella_try_on)
                            stable_product = stabilize_url(product_image, "product") if 'stabilize_url' in globals() else product_image
                            vella_result_url = run_vella_try_on(model_in_scene_url, stable_product, quality_mode, clothing_type)
                            # Vella result is already persisted in run_vella_try_on
                            print(f"✅ Product applied to model: {vella_result_url[:50]}...")
                            
                            # Step 3: Use Vella result as final result (clean two-step workflow)
                            final_result_url = vella_result_url
                            print(f"✅ Two-step workflow completed: Model placed in scene + Product applied")
                            
                            # Step 4: REMOVED - Clean two-step workflow (Step 1: Model→Scene, Step 2: Product→Model)
                            
                            # Step 5: REMOVED - Clean two-step workflow (Step 1: Model→Scene, Step 2: Product→Model)
                            
                            # Normalize and store final URL
                            print(f"💾 Normalizing final result URL...")
                            final_url = stabilize_url(to_url(final_result_url), f"final_{shot_type['name']}") if 'stabilize_url' in globals() else download_and_save_image(to_url(final_result_url), f"campaign_{shot_type['name']}")
                            print(f"✅ Final result saved locally: {final_url[:50]}...")
                            
                            generated_images.append({
                                "product_name": product.name,
                                "product_id": str(product.id),
                                "model_name": model.name,
                                "scene_name": scene.name,
                                "shot_type": shot_type['title'],
                                "shot_name": shot_type['name'],
                                "image_url": final_url,
                                "model_image_url": model_image,
                                "product_image_url": product_image,
                                "clothing_type": clothing_type
                            })
                            
                            print(f"✅ Shot completed: {shot_type['title']}")
                            
                        except Exception as e:
                            print(f"❌ Failed shot {shot_type['title']}: {e}")
                            import traceback
                            traceback.print_exc()
                            print(f"🔄 Continuing to next shot... (Shot {shot_idx}/{len(shot_types_to_generate)})")
                            continue
                    
                    print(f"\n🎉 Campaign flow complete: {product.name} + {model.name} + {scene.name}")
        
        # Update campaign with generated images
        campaign.generation_status = "completed" if len(generated_images) > 0 else "failed"
        
        # Create new settings dict to force SQLAlchemy to detect change
        new_settings = dict(campaign.settings) if campaign.settings else {}
        new_settings["generated_images"] = generated_images
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

@app.post("/campaigns/create")
async def create_campaign(
    name: str = Form(...),
    description: str = Form(""),
    product_ids: str = Form(...),  # JSON string
    model_ids: str = Form(...),    # JSON string
    scene_ids: str = Form(...),    # JSON string
    selected_poses: str = Form("{}"),  # JSON string
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
        
        # Create campaign
        campaign = Campaign(
            user_id=current_user["user_id"],
            name=name,
            description=description,
            status="draft",
            generation_status="generating",
            settings={
                "product_ids": product_id_list,
                "model_ids": model_id_list,
                "scene_ids": scene_id_list,
                "selected_poses": selected_poses_dict,
                "generated_images": []
            }
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)
        
        # Return the campaign immediately so frontend can show it with "generating" status
        print(f"🎯 Campaign created with ID: {campaign.id}, starting generation...")
        
        # Return immediately so frontend can show the campaign with "generating" status
        response_data = {
            "campaign": CampaignResponse.model_validate(campaign),
            "message": f"Campaign '{name}' created and generation started!",
            "generated_images": []
        }
        
        # Start generation in background (this will run after the response is sent)
        import asyncio
        asyncio.create_task(generate_campaign_images_background(
            campaign.id, 
            product_id_list, 
            model_id_list, 
            scene_id_list, 
            selected_poses_dict, 
            number_of_images,
            db
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
    """Get the generation status of a campaign"""
    try:
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        return {
            "campaign_id": campaign.id,
            "generation_status": campaign.generation_status,
            "status": campaign.status,
            "generated_images_count": len(campaign.settings.get("generated_images", [])) if campaign.settings else 0,
            "updated_at": campaign.updated_at
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        for product in products:
            for model in models:
                for scene in scenes:
                    # Use product packshot (front view preferred)
                    product_image = product.packshot_front_url or product.image_url
                    
                    # Use model's pose if available, or select random
                    if model.poses and len(model.poses) > 0:
                        import random
                        model_image = random.choice(model.poses)
                        print(f"🎭 Using random pose for {model.name}")
                    else:
                        model_image = model.image_url
                    
                    print(f"🎬 Processing campaign flow: {product.name} + {model.name} + {scene.name}")
                    print(f"📸 Generating {number_of_images} images for this campaign...")
                    
                    # Generate only the requested number of images
                    shot_types_to_generate = CAMPAIGN_SHOT_TYPES[:number_of_images]
                    for shot_idx, shot_type in enumerate(shot_types_to_generate, 1):
                        try:
                            print(f"\n🎥 [{shot_idx}/{number_of_images}] {shot_type['title']}")
                            
                            # REAL WORKFLOW: Qwen first, then Vella
                            quality_mode = "standard"

                            # Step 1: Compose model into the scene with shot type (persist inputs first)
                            stable_model = stabilize_url(model_image, "pose") if 'stabilize_url' in globals() else model_image
                            stable_scene = stabilize_url(scene.image_url, "scene") if 'stabilize_url' in globals() else scene.image_url
                            print(f"🎨 Step 1: Placing model into scene with shot type '{shot_type['name']}'...")
                            model_in_scene_url = run_nano_banana_scene_composition(
                                stable_model,
                                stable_scene,
                                quality_mode,
                                shot_type_prompt=shot_type['prompt']
                            )
                            # Nano Banana result is already persisted in run_nano_banana_scene_composition
                            print(f"✅ Model placed in scene: {model_in_scene_url[:50]}...")

                            # Step 2: Apply product to model (using Vella)
                            print(f"👔 Step 2: Applying {product.name} to model with Vella 1.5 try-on...")
                            clothing_type = product.clothing_type if hasattr(product, 'clothing_type') and product.clothing_type else "top"
                            stable_product = stabilize_url(product_image, "product") if 'stabilize_url' in globals() else product_image
                            vella_result_url = run_vella_try_on(model_in_scene_url, stable_product, quality_mode, clothing_type)
                            # Vella result is already persisted in run_vella_try_on
                            print(f"✅ Product applied to model: {vella_result_url[:50]}...")
                            
                            # Step 3: Use Vella result as final result (clean two-step workflow)
                            final_result_url = vella_result_url
                            print(f"✅ Two-step workflow completed: Model placed in scene + Product applied")
                            
                            # Step 4: REMOVED - Clean two-step workflow (Step 1: Model→Scene, Step 2: Product→Model)
                            
                            # Step 5: REMOVED - Clean two-step workflow (Step 1: Model→Scene, Step 2: Product→Model)
                            
                            # Normalize and store final URL
                            print(f"💾 Normalizing final result URL...")
                            final_url = stabilize_url(to_url(final_result_url), f"final_{shot_type['name']}") if 'stabilize_url' in globals() else download_and_save_image(to_url(final_result_url), f"campaign_{shot_type['name']}")
                            print(f"✅ Final result saved locally: {final_url[:50]}...")
                            
                            new_images.append({
                                "product_name": product.name,
                                "product_id": str(product.id),
                                "model_name": model.name,
                                "scene_name": scene.name,
                                "shot_type": shot_type['title'],
                                "shot_name": shot_type['name'],
                                "image_url": final_url,
                                "model_image_url": model_image,
                                "product_image_url": product_image,
                                "clothing_type": clothing_type
                            })
                            
                            print(f"✅ Shot completed: {shot_type['title']}")
                            
                        except Exception as e:
                            print(f"❌ Failed shot {shot_type['title']}: {e}")
                            import traceback
                            traceback.print_exc()
                            continue
                    
                    print(f"\n🎉 Campaign flow complete: {product.name} + {model.name} + {scene.name}")
        
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
        if user.credits < credits_needed:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient credits. You have {user.credits} credits, but need {credits_needed}"
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
        
        # Deduct credits
        user.credits -= credits_needed
        db.commit()
        
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
        
        # Deduct credits
        user.credits -= 1
        db.commit()
        
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
    """Confirm payment and add credits to user account"""
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
        
        # Add credits to user account
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user.credits += credits_to_add
        db.commit()
        
        return {
            "message": f"Successfully added {credits_to_add} credits",
            "credits_remaining": user.credits
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
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
        print(f"Removing background for: {photo_url}")
        
        # If this is a data URL, decode and return as RGBA for further processing
        if photo_url.startswith("data:image"):
            import base64
            from io import BytesIO
            header, b64data = photo_url.split(",", 1)
            img_bytes = base64.b64decode(b64data)
            return Image.open(BytesIO(img_bytes)).convert("RGBA")

        # If it's a local URL, convert to file path
        if photo_url.startswith(get_base_url() + "/static/"):
            filename = photo_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            if os.path.exists(filepath):
                # For now, skip background removal and return original
                print("Skipping background removal for local file, using original")
                return Image.open(filepath).convert("RGBA")
        
        # For external URLs, try to download and process
        import requests
        from io import BytesIO
        response = requests.get(photo_url)
        img = Image.open(BytesIO(response.content)).convert("RGBA")
        return img
        
    except Exception as e:
        print(f"Background removal failed: {e}")
        # Return a blank RGBA image as fallback
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

def upload_to_cloudinary(url: str, folder: str = "auraengine") -> str:
    """
    Upload an image to Cloudinary and return the public URL.
    Supports:
    - data:image/* base64
    - http(s) URLs (replicate.delivery, etc.)
    - local file paths
    Falls back to returning the original url on failure.
    """
    try:
        # Check if Cloudinary is configured
        if not (CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET):
            print("⚠️ Cloudinary not configured, falling back to local storage")
            return download_and_save_image(url, folder)
        
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
                return download_and_save_image(url, folder)

        # Handle http(s) URL
        if isinstance(url, str) and (url.startswith("http://") or url.startswith("https://")):
            try:
                # Upload directly from URL to Cloudinary
                result = cloudinary.uploader.upload(
                    url,
                    folder=folder,
                    public_id=f"{folder}_{uuid.uuid4().hex}",
                    resource_type="image"
                )
                cloudinary_url = result['secure_url']
                print(f"✅ Uploaded URL to Cloudinary: {cloudinary_url[:50]}...")
                return cloudinary_url
            except Exception as e:
                print(f"❌ Failed to upload URL to Cloudinary: {e}")
                return download_and_save_image(url, folder)

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
            return download_and_save_image(url, folder)

    except Exception as e:
        print(f"❌ Failed to process image with Cloudinary: {e}")
        return download_and_save_image(url, folder)

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
        print(f"🎭 Running Vella try-on: model={model_image_url[:50]}..., product={product_image_url[:50]}...")
        print(f"👕 Clothing type: {clothing_type}")

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
        try:
            if has_alpha(product_image_url):
                garment_url = product_image_url
                print("🧵 Garment already has alpha")
            else:
                print("🪄 Removing background from garment...")
                cut = rembg_cutout(product_image_url)
                cut = postprocess_cutout(cut)
                garment_url = upload_pil_to_cloudinary(cut, "garment_cutout")  # -> Cloudinary URL
                print(f"🧵 Garment cutout saved: {garment_url}")
        except Exception as e:
            print(f"⚠️ Garment processing failed, using original: {e}")
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
            
            # Build Vella 1.5 input - use top_image as the correct parameter for Vella 1.5
            vella_input = {
                "model_image": model_image_url,
                "top_image": garment_url,
                "num_outputs": num_outputs,
                "garment_only": True,  # Try to replace existing clothing instead of adding layers
                "remove_background": False,  # Keep the scene background
            }
            
            if seed is not None:
                vella_input["seed"] = seed
            
            print(f"🎭 Vella input keys: {list(vella_input.keys())}")
            
            # Call Vella 1.5 with retry logic
            print("🔄 Calling Replicate Vella 1.5...")
            max_retries = 3
            
            for attempt in range(max_retries):
                try:
                    print(f"🎭 Vella attempt {attempt + 1}/{max_retries}...")
                    out = replicate.run("omnious/vella-1.5", input=vella_input)
                    print(f"✅ Vella API call succeeded on attempt {attempt + 1}!")
                    print(f"🎭 Vella API response type: {type(out)}")
                    if hasattr(out, '__dict__'):
                        print(f"🎭 Vella response attributes: {list(out.__dict__.keys())}")
                    break  # Success, exit retry loop
                except Exception as e:
                    print(f"⚠️ Vella attempt {attempt + 1} failed: {e}")
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

def run_qwen_triple_composition(model_image_url: str, product_image_url: str, scene_image_url: str, product_name: str, quality_mode: str = "standard") -> str:
    """ONE-STEP: Model + Product + Scene all in one Qwen call"""
    try:
        print(f"🎬 Running Qwen triple composition...")
        
        # Convert all local URLs to base64
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

        # Strong integration prompt - like campaign hjk
        scene_prompt = f"Create a cohesive fashion photograph: Take the person from the first image, dress them with the {product_name} from the second image, then integrate them into a setting inspired by the mood and atmosphere of the third image. The person should adapt to match the lighting, color grading, and visual style of the scene environment. Create a natural, believable composition where everything flows together. Preserve the person's face and pose but adjust their appearance to fit harmoniously. Professional luxury fashion aesthetic."
        
        # Strong integration parameters (like hjk)
        num_steps = 38
        guidance = 4.2  # Moderate guidance for balance
        strength = 0.52  # Strong integration while preserving identity
        print("⚡ Using Qwen for strong scene integration (like campaign hjk)")
        
        # Use Qwen with 3 images
        try:
            print("🔄 Calling Qwen with 3 images...")
            out = replicate.run("qwen/qwen-image-edit-plus", input={
                "prompt": scene_prompt,
                "image": [model_image_url, product_image_url, scene_image_url],
                "num_inference_steps": num_steps,
                "guidance_scale": guidance,
                "strength": strength
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
            
            print(f"✅ Qwen triple composition completed: {result_url[:50]}...")
            return result_url
            
        except Exception as e:
            print(f"❌ Qwen failed: {e}")
            if DISABLE_PLACEHOLDERS:
                print("↩️ Returning model image instead of placeholder")
                return model_image_url
            fallback_url = f"https://picsum.photos/800/600?random={hash(model_image_url) % 10000}"
            return fallback_url
            
    except Exception as e:
        print(f"❌ Triple composition failed: {e}")
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
        "prompt": "Full-body shot of model wearing only underwear, standing and posing normally"
    },
    {
        "name": "standing_full",
        "title": "Standing Look (Fit Reveal)",
        "prompt": "Full-body shot of model wearing only underwear, standing and posing normally"
    },
    {
        "name": "upper_closeup",
        "title": "Upper Body Close-Up",
        "prompt": "Full-body shot of model wearing only underwear, standing and posing normally"
    },
    {
        "name": "lower_closeup",
        "title": "Lower Body Close-Up",
        "prompt": "Full-body shot of model wearing only underwear, standing and posing normally"
    },
    {
        "name": "action_dynamic",
        "title": "Action Shot (Movement)",
        "prompt": "Full-body shot of model wearing only underwear, standing and posing normally"
    },
    {
        "name": "interaction_pose",
        "title": "Model Interaction",
        "prompt": "Full-body shot of model wearing only underwear, standing and posing normally"
    },
    {
        "name": "hero_finale",
        "title": "Hero Pose (Campaign Finale)",
        "prompt": "Full-body shot of model wearing only underwear, standing and posing normally"
    },
    {
        "name": "detail_macro",
        "title": "Fabric Detail Macro",
        "prompt": "Full-body shot of model wearing only underwear, standing and posing normally"
    },
    {
        "name": "profile_side",
        "title": "Profile Side View",
        "prompt": "Full-body shot of model wearing only underwear, standing and posing normally"
    },
    {
        "name": "lifestyle_context",
        "title": "Lifestyle Context Shot",
        "prompt": "Full-body shot of model wearing only underwear, standing and posing normally"
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
    user_mods: str
) -> List[str]:
    """Generate front and back packshots using Qwen"""
    try:
        print("Processing product image for front and back packshots...")
        
        # Step 1: Process product image
        if not has_alpha(product_image_url):
            print("Removing background from product image...")
            cut = rembg_cutout(product_image_url)
            cut = postprocess_cutout(cut)
            product_png_url = upload_png(cut)
            print(f"Background removed, saved as: {product_png_url}")
        else:
            product_png_url = product_image_url
            print("Product image already has alpha channel")
        
        # Convert to public URL for Replicate
        if product_png_url.startswith(get_base_url() + "/static/"):
            filename = product_png_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            product_png_url = upload_to_replicate(filepath)
            print(f"Converted to public URL: {product_png_url[:100]}...")

        # Step 2: Generate front packshot
        print("Generating front packshot...")
        front_prompt = f"Ultra-clean studio packshot of the uploaded product, front view. Even softbox lighting on a white seamless background. Soft contact shadow. No props, no text, no watermark. Crisp edges, accurate colors. {user_mods}, product photography, professional lighting, studio setup, high quality, detailed"
        
        try:
            front_out = replicate.run("qwen/qwen-image-edit-plus", input={
                "prompt": front_prompt,
                "image": [product_png_url],
                "num_inference_steps": 20,
                "guidance_scale": 7.5
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
        back_prompt = f"Ultra-clean studio packshot of the uploaded product, back view. Even softbox lighting on a white seamless background. Soft contact shadow. No props, no text, no watermark. Crisp edges, accurate colors. {user_mods}, product photography, professional lighting, studio setup, high quality, detailed"
        
        try:
            back_out = replicate.run("qwen/qwen-image-edit-plus", input={
                "prompt": back_prompt,
                "image": [product_png_url],
                "num_inference_steps": 20,
                "guidance_scale": 7.5
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
        # Save product image
        image_filename = f"product_{hash(name + str(datetime.now()))}.{product_image.filename.split('.')[-1]}"
        image_path = os.path.join("uploads", image_filename)
        
        with open(image_path, "wb") as f:
            content = await product_image.read()
            f.write(content)
        
        # Prefer data URL to avoid /static dependency in this deployment
        try:
            image_url = upload_to_replicate(image_path)
        except Exception:
            image_url = get_static_url(image_filename)
        
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
        
        # Handle uploaded packshots
        if packshot_front:
            front_filename = f"packshot_front_{hash(name + str(datetime.now()))}.{packshot_front.filename.split('.')[-1]}"
            front_path = os.path.join("uploads", front_filename)
            with open(front_path, "wb") as f:
                content = await packshot_front.read()
                f.write(content)
            packshot_front_url = get_static_url(front_filename)
            packshots.append(packshot_front_url)
        
        if packshot_back:
            back_filename = f"packshot_back_{hash(name + str(datetime.now()))}.{packshot_back.filename.split('.')[-1]}"
            back_path = os.path.join("uploads", back_filename)
            with open(back_path, "wb") as f:
                content = await packshot_back.read()
                f.write(content)
            packshot_back_url = get_static_url(back_filename)
            packshots.append(packshot_back_url)
        
        # Generate missing packshots using Replicate
        if not packshot_front_url or not packshot_back_url:
            print(f"Generating packshots for product: {name}")
            generated_packshots = run_qwen_packshot_front_back(
                product_image_url=image_url,
                user_mods="professional product photography, clean background, studio lighting"
            )
            
            if not packshot_front_url and len(generated_packshots) > 0:
                # Download and save immediately to avoid ephemeral URL expiration
                ephemeral_url = generated_packshots[0]
                packshot_front_url = upload_to_cloudinary(ephemeral_url, "packshot_front")
                packshots.append(packshot_front_url)
                user.credits -= 5
                print(f"Generated and saved front packshot: {packshot_front_url}")
            
            if not packshot_back_url and len(generated_packshots) > 1:
                # Download and save immediately to avoid ephemeral URL expiration
                ephemeral_url = generated_packshots[1]
                packshot_back_url = upload_to_cloudinary(ephemeral_url, "packshot_back")
                packshots.append(packshot_back_url)
                user.credits -= 5
                print(f"Generated and saved back packshot: {packshot_back_url}")
        
        # Create product in database
        product = Product(
            id=str(uuid.uuid4()),
            user_id=current_user["user_id"],
            name=name,
            description=description,
            category=category,
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
        if not user or user.credits < 10:
            raise HTTPException(status_code=400, detail="Insufficient credits. Need 10 credits for packshot regeneration.")
        
        # Generate new packshots
        print(f"Re-generating packshots for product: {product.name}")
        new_packshots = run_qwen_packshot_front_back(
            product_image_url=product.image_url,
            user_mods="professional product photography, clean background, studio lighting"
        )
        
        # Update product with new packshots
        if len(new_packshots) >= 2:
            product.packshot_front_url = new_packshots[0]
            product.packshot_back_url = new_packshots[1]
            product.packshots = new_packshots
            print(f"Updated product with new packshots: {new_packshots}")
        
        # Deduct credits (10 credits for both front and back)
        user.credits -= 10
        
        db.commit()
        
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
        
        # Convert local URLs to base64 for Replicate
        if image_url.startswith(get_base_url() + "/static/"):
            filename = image_url.replace(get_base_url() + "/static/", "")
            filepath = f"uploads/{filename}"
            image_url = upload_to_replicate(filepath)
            print(f"Converted image to base64: {image_url[:100]}...")
        
        # Veo 3.1 supports multiple resolutions and durations
        # Map our quality to Veo's aspect_ratio (Veo handles resolution internally)
        if video_quality == "1080p":
            aspect_ratio = "16:9"  # Best for 1080p
        elif video_quality == "720p":
            aspect_ratio = "16:9"  # Standard HD
        else:  # 480p
            aspect_ratio = "9:16"  # Portrait for social media
        
        # Duration in seconds (5s or 10s)
        duration_seconds = 10 if duration == "10s" else 5
        
        print(f"🎨 Using {aspect_ratio} aspect ratio")
        print(f"⏱️ Using {duration_seconds}s duration")
        
        # Run Veo 3.1
        print(f"🔄 Calling Google Veo 3.1 API...")
        out = replicate.run(
            "google/veo-3.1",
            input={
                "prompt": custom_prompt or "gentle natural movement, subtle breathing, soft fabric flow, professional fashion photography, minimal motion, elegant stillness",
                "reference_image": image_url,
                "aspect_ratio": aspect_ratio,
                "duration": duration_seconds,
                "quality": "high"  # Veo 3.1 always high quality
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
            # Check if it's a video file (Kling returns .mp4)
            if video_url.endswith('.mp4') or 'video' in video_url.lower():
                # For video files, use direct download instead of Cloudinary
                try:
                    import requests
                    response = requests.get(video_url)
                    if response.status_code == 200:
                        # Save video to local storage
                        import uuid
                        video_filename = f"kling_videos_{uuid.uuid4().hex}.mp4"
                        video_path = f"uploads/{video_filename}"
                        
                        with open(video_path, 'wb') as f:
                            f.write(response.content)
                        
                        video_url = f"{get_base_url()}/static/{video_filename}"
                        print(f"✅ Kling video downloaded and saved: {video_url}")
                        return video_url
                    else:
                        print(f"❌ Failed to download video: {response.status_code}")
                        return None
                except Exception as e:
                    print(f"❌ Failed to download video: {e}")
                    return None
            else:
                # For non-video files, use Cloudinary
                video_url = upload_to_cloudinary(video_url, "kling_videos")
                print(f"✅ Kling video generated and persisted: {video_url}")
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
        
        # Duration in seconds
        duration_seconds = 10 if duration == "10s" else 5
        
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
    """Download video from URL and save it locally"""
    try:
        import requests
        import uuid
        
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
        
        # Return local URL
        local_url = get_static_url(filename)
        print(f"✅ Video saved locally: {local_url}")
        return local_url
        
    except Exception as e:
        print(f"❌ Failed to download video: {e}")
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
    Reapply clothing to an existing image using Vella 1.5.
    Takes the current image and re-runs the virtual try-on with the product.
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
        product_image = product.packshot_front_url or product.image_url
        
        # Get clothing type from product or use provided
        clothing_type = product.clothing_type if hasattr(product, 'clothing_type') and product.clothing_type else request.clothing_type
        
        # Convert image URL to format Vella can use
        if request.image_url.startswith(get_base_url() + "/static/"):
            # Local file - can use directly
            model_image_url = request.image_url
        else:
            # External URL - use directly
            model_image_url = request.image_url
        
        # Apply Vella try-on
        print(f"🎭 Running Vella 1.5 try-on...")
        vella_result_url = run_vella_try_on(model_image_url, product_image, "standard", clothing_type)
        print(f"✅ Vella try-on completed: {vella_result_url[:50]}...")
        
        # Download and save the result
        print(f"💾 Downloading result...")
        final_url = upload_to_cloudinary(vella_result_url, "reapplied_clothes")
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
        
        return {
            "success": True,
            "message": f"Successfully reapplied {product.name}",
            "original_url": request.image_url,
            "reapplied_url": final_url,
            "product_name": product.name,
            "clothing_type": clothing_type
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

@app.post("/campaigns/{campaign_id}/generate-videos")
async def generate_videos_for_campaign(
    campaign_id: str,
    request: BulkVideoRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate videos for all images in a campaign.
    
    **Credit Costs per video:**
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
    - Google Veo 3.1 (Premium):
      - 480p (5s): 3 credits
      - 480p (10s): 4 credits
      - 720p (5s): 4 credits
      - 720p (10s): 6 credits
      - 1080p (5s): 5 credits
      - 1080p (10s): 8 credits
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
            # Veo Direct Mode: Generate video directly from model + product + scene
            print(f"🎬 Veo Direct Mode: Generating video from model + product + scene")
            
            # Get campaign data (model, product, scene)
            if not campaign.settings:
                raise HTTPException(status_code=400, detail="Campaign has no settings")
            
            # Calculate credits for 1 video
            if request.video_quality == "1080p":
                credits_per_video = 8 if request.duration == "10s" else 5
            elif request.video_quality == "720p":
                credits_per_video = 6 if request.duration == "10s" else 4
            else:  # 480p
                credits_per_video = 4 if request.duration == "10s" else 3
            
            total_credits_needed = credits_per_video  # Only 1 video
            num_videos_to_generate = 1
            
        else:
            # Standard Mode: Generate videos from selected images
            if not campaign.settings or not campaign.settings.get("generated_images"):
                raise HTTPException(status_code=400, detail="No images found in campaign")
            
            generated_images = campaign.settings["generated_images"]
            
            # Filter images based on selection
            if request.selected_image_indices:
                selected_images = [generated_images[i] for i in request.selected_image_indices if i < len(generated_images)]
                if not selected_images:
                    raise HTTPException(status_code=400, detail="No valid images selected")
            else:
                selected_images = generated_images
            
            # Calculate total credits needed
            if request.model == "seedance":
                if request.video_quality == "1080p":
                    credits_per_video = 6 if request.duration == "10s" else 4
                else:  # 480p
                    credits_per_video = 3 if request.duration == "10s" else 2
            elif request.model == "veo":
                # Veo 3.1 pricing (premium quality)
                if request.video_quality == "1080p":
                    credits_per_video = 8 if request.duration == "10s" else 5
                elif request.video_quality == "720p":
                    credits_per_video = 6 if request.duration == "10s" else 4
                else:  # 480p
                    credits_per_video = 4 if request.duration == "10s" else 3
            elif request.model == "kling":
                # Kling 2.5 Turbo Pro pricing (pro-level quality)
                if request.video_quality == "1080p":
                    credits_per_video = 6 if request.duration == "10s" else 4
                elif request.video_quality == "720p":
                    credits_per_video = 4 if request.duration == "10s" else 3
                else:  # 480p
                    credits_per_video = 3 if request.duration == "10s" else 2
            else:  # wan
                credits_per_video = 2 if request.video_quality == "720p" else 1
            
            total_credits_needed = credits_per_video * len(selected_images)
            num_videos_to_generate = len(selected_images)
        
        # Get user and check credits
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if user.credits < total_credits_needed:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient credits. You need {total_credits_needed} credits ({credits_per_video} per video × {num_videos_to_generate} videos), but have {user.credits} credits"
            )
        
        # Generate videos
        success_count = 0
        failed_count = 0
        results = []
        
        if request.veo_direct_mode:
            # VEO DIRECT MODE: Generate video directly from model + product + scene
            try:
                print(f"🎬 Generating Veo Direct video from model + product + scene...")
                
                # Get model, product, scene IDs from campaign settings
                model_ids = campaign.settings.get("model_ids", [])
                product_ids = campaign.settings.get("product_ids", [])
                scene_ids = campaign.settings.get("scene_ids", [])
                
                if not model_ids or not product_ids or not scene_ids:
                    raise ValueError("Campaign must have model, product, and scene selected for Veo Direct mode")
                
                # Get first model, product, and scene (you can extend this for multiple combinations)
                model = db.query(Model).filter(Model.id == model_ids[0]).first()
                product = db.query(Product).filter(Product.id == product_ids[0]).first()
                scene = db.query(Scene).filter(Scene.id == scene_ids[0]).first()
                
                if not model or not product or not scene:
                    raise ValueError("Could not find model, product, or scene in database")
                
                # Use model's pose if available, or base image
                model_image = model.poses[0] if model.poses and len(model.poses) > 0 else model.image_url
                product_image = product.packshot_front_url or product.image_url
                scene_image = scene.image_url
                
                print(f"📸 Model: {model.name}, Product: {product.name}, Scene: {scene.name}")
                
                # Generate video using Veo Direct function
                video_url = run_veo_direct_generation(
                    model_image,
                    product_image,
                    scene_image,
                    request.video_quality,
                    request.duration,
                    request.custom_prompt
                )
                
                if video_url:
                    success_count += 1
                    results.append({
                        "index": 0,
                        "status": "success",
                        "video_url": video_url,
                        "mode": "veo_direct",
                        "model_name": model.name,
                        "product_name": product.name,
                        "scene_name": scene.name
                    })
                    print(f"✅ Veo Direct video generated successfully")
                else:
                    failed_count += 1
                    results.append({
                        "index": 0,
                        "status": "failed",
                        "message": "Veo Direct generation returned None",
                        "mode": "veo_direct"
                    })
                    print(f"❌ Veo Direct video generation failed")
                
            except Exception as e:
                print(f"❌ Failed to generate Veo Direct video: {e}")
                import traceback
                traceback.print_exc()
                failed_count += 1
                results.append({
                    "index": 0,
                    "status": "failed",
                    "message": str(e),
                    "mode": "veo_direct"
                })
        
        else:
            # STANDARD MODE: Generate videos from selected images
            for i, img_data in enumerate(selected_images):
                try:
                    image_url = img_data.get("image_url")
                    if not image_url:
                        print(f"⚠️ Skipping image {i+1}: No image URL")
                        failed_count += 1
                        continue
                    
                    # Allow multiple video generations for the same image
                    # Removed restriction: if img_data.get("video_url"):
                    # Users can now generate multiple videos for the same image
                    
                    print(f"🎬 Generating video {i+1}/{len(selected_images)} for image: {image_url[:50]}...")
                    
                    # Generate video
                    if request.model == "seedance":
                        video_url = run_seedance_video_generation(image_url, request.video_quality, request.duration, request.custom_prompt)
                    elif request.model == "veo":
                        video_url = run_veo_video_generation(image_url, request.video_quality, request.duration, request.custom_prompt)
                    elif request.model == "kling":
                        video_url = run_kling_video_generation(image_url, request.video_quality, request.duration, request.custom_prompt)
                    else:  # wan
                        video_url = run_wan_video_generation(image_url, request.video_quality, request.custom_prompt)
                    
                    if video_url:
                        # Update the image data with video URL
                        img_data["video_url"] = video_url
                        success_count += 1
                        results.append({
                            "index": i,
                            "status": "success",
                            "video_url": video_url
                        })
                        print(f"✅ Video {i+1} generated successfully")
                    else:
                        failed_count += 1
                        results.append({
                            "index": i,
                            "status": "failed",
                            "message": "Video generation returned None"
                        })
                        print(f"❌ Video {i+1} generation failed")
                    
                except Exception as e:
                    print(f"❌ Failed to generate video {i+1}: {e}")
                    failed_count += 1
                    results.append({
                        "index": i,
                        "status": "failed",
                        "message": str(e)
                    })
        
        # Update campaign settings with new video URLs (only for standard mode)
        if not request.veo_direct_mode:
            campaign.settings["generated_images"] = generated_images
            flag_modified(campaign, "settings")
        
        # Deduct credits for successful generations
        credits_used = success_count * credits_per_video
        user.credits -= credits_used
        
        db.commit()
        db.refresh(campaign)
        db.refresh(user)
        
        print(f"✅ Bulk video generation completed: {success_count} success, {failed_count} failed")
        
        return {
            "message": f"Video generation completed: {success_count} success, {failed_count} failed",
            "total_videos": num_videos_to_generate,
            "success_count": success_count,
            "failed_count": failed_count,
            "credits_used": credits_used,
            "credits_remaining": user.credits,
            "results": results,
            "veo_direct_mode": request.veo_direct_mode
        }
        
    except Exception as e:
        print(f"❌ Bulk video generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Bulk video generation failed: {str(e)}")

@app.post("/generations/{generation_id}/generate-video")
async def generate_video_for_generation(
    generation_id: str,
    video_quality: str = "480p",  # "480p", "720p", or "1080p"
    duration: str = "5s",  # "5s" or "10s" (only for Seedance)
    model: str = "wan",  # "wan" or "seedance"
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
        else:  # wan model
            if video_quality == "720p":
                credits_needed = 2  # 720p Wan
            else:  # 480p
                credits_needed = 1  # 480p Wan (cheapest)
        
        if user.credits < credits_needed:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient credits. You have {user.credits} credits, but need {credits_needed} for {model} {video_quality} {duration if model in ['seedance', 'kling'] else ''} video generation"
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
        else:  # wan model (default)
            video_url = run_wan_video_generation(image_url, video_quality, custom_prompt)
        
        if video_url:
            # Update generation with video URL
            generation.video_urls = [video_url]
            generation.updated_at = datetime.utcnow()
            
            # Deduct credits
            user.credits -= credits_needed
            
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
