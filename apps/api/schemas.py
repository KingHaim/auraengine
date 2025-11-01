from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

# User schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    is_active: bool
    is_verified: bool
    credits: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Campaign schemas
class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    settings: Optional[Dict[str, Any]] = {}

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

class CampaignResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    generation_status: str
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Product schemas
class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    clothing_type: Optional[str] = None  # "tshirt", "pants", "sweater", "jacket", "shoes", etc.
    tags: Optional[List[str]] = []

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    clothing_type: Optional[str] = None
    tags: Optional[List[str]] = None

class ProductResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    image_url: Optional[str]
    packshots: List[str]
    packshot_front_url: Optional[str]
    packshot_back_url: Optional[str]
    packshot_front_type: Optional[str]
    packshot_back_type: Optional[str]
    category: Optional[str]
    clothing_type: Optional[str]
    tags: List[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Model schemas
class ModelCreate(BaseModel):
    name: str
    description: Optional[str] = None
    gender: Optional[str] = None

class ModelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    gender: Optional[str] = None
    poses: Optional[List[str]] = None

class ModelResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    image_url: Optional[str]
    gender: Optional[str]
    poses: List[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class SceneCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None

class SceneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None

class SceneResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    image_url: Optional[str]
    is_standard: bool
    category: Optional[str]
    tags: List[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Generation schemas
class GenerationRequest(BaseModel):
    mode: str  # packshot, backshot
    user_mods: Optional[str] = ""
    angle: str = "front"
    background: str = "white"
    reflection: bool = False
    shadow_strength: float = 0.35
    variants: int = 4
    campaign_id: Optional[str] = None
    product_id: Optional[str] = None

class GenerationResponse(BaseModel):
    id: str
    mode: str
    prompt: str
    settings: Dict[str, Any]
    input_image_url: Optional[str]
    output_urls: List[str]
    status: str
    credits_used: int
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# API Response schemas
class MessageResponse(BaseModel):
    message: str
    success: bool = True

class ErrorResponse(BaseModel):
    detail: str
    success: bool = False
