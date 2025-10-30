#!/usr/bin/env python3
"""
Stable working version of main.py with fixed login endpoint
"""
from fastapi import FastAPI, HTTPException, Depends, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from database import SessionLocal, create_tables
from models import User, Product, Model, Scene, Campaign, Generation
from schemas import UserCreate, UserResponse, Token, ProductResponse, ModelResponse, SceneResponse, CampaignResponse
from auth import get_current_user, create_access_token, verify_password, get_password_hash
from datetime import datetime, timedelta
import os
import json
import stripe
import uuid
from pydantic import BaseModel

# Pydantic models
class LoginRequest(BaseModel):
    email: str
    password: str

# Initialize FastAPI app
app = FastAPI(title="Beating Heart API", version="1.0.0")

# Create database tables on startup
@app.on_event("startup")
async def startup_event():
    create_tables()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="uploads"), name="static")

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
    return {"message": "Beating Heart API"}

@app.get("/health")
async def health():
    return {"status": "healthy", "message": "Beating Heart API is running"}

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
        email = login_data.email
        password = login_data.password
        
        user = db.query(User).filter(User.email == email).first()
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        
        # Create access token
        access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse.from_orm(user)
        }
        
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

@app.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a product"""
    try:
        # Convert string to UUID if needed
        try:
            import uuid
            product_uuid = uuid.UUID(product_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid product ID format")
        
        product = db.query(Product).filter(
            Product.id == product_uuid,
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/campaigns", response_model=list[CampaignResponse])
async def get_campaigns(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all campaigns for the current user"""
    try:
        campaigns = db.query(Campaign).filter(Campaign.user_id == current_user["user_id"]).all()
        return campaigns
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a campaign"""
    try:
        # Convert string to UUID if needed
        try:
            import uuid
            campaign_uuid = uuid.UUID(campaign_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid campaign ID format")
        
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_uuid,
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
        "publishable_key": os.getenv("STRIPE_PUBLISHABLE_KEY", "pk_test_51234567890abcdefghijklmnopqrstuvwxyz")
    }

# ---------- User Management ----------
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

@app.get("/user/profile")
async def get_user_profile(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user profile"""
    try:
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return UserResponse.from_orm(user)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
