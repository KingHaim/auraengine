from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    credits = Column(Integer, default=100)  # Free credits for new users
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    campaigns = relationship("Campaign", back_populates="user")
    products = relationship("Product", back_populates="user")
    models = relationship("Model", back_populates="user")
    scenes = relationship("Scene", back_populates="user")
    generations = relationship("Generation", back_populates="user")

class Campaign(Base):
    __tablename__ = "campaigns"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="draft")  # draft, active, completed, archived
    settings = Column(JSON, default=dict)  # Store campaign-specific settings
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="campaigns")
    generations = relationship("Generation", back_populates="campaign")

class Product(Base):
    __tablename__ = "products"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)  # Original product image
    packshots = Column(JSON, default=list)  # Generated packshot URLs
    packshot_front_url = Column(String, nullable=True)  # User-uploaded front packshot
    packshot_back_url = Column(String, nullable=True)  # User-uploaded back packshot
    packshot_front_type = Column(String, nullable=True)  # "front" or "back"
    packshot_back_type = Column(String, nullable=True)  # "front" or "back"
    category = Column(String, nullable=True)
    clothing_type = Column(String, nullable=True)  # "tshirt", "pants", "sweater", "jacket", "shoes", etc.
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="products")
    generations = relationship("Generation", back_populates="product")

class Model(Base):
    __tablename__ = "models"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)  # Original model photo
    gender = Column(String, nullable=True)  # male, female
    poses = Column(JSON, default=list)  # List of generated pose URLs
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="models")
    generations = relationship("Generation", back_populates="model")

class Scene(Base):
    __tablename__ = "scenes"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)  # Scene background image
    is_standard = Column(Boolean, default=False)  # True for built-in scenes
    category = Column(String, nullable=True)  # "studio", "outdoor", "lifestyle", etc.
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="scenes")
    generations = relationship("Generation", back_populates="scene")

class Generation(Base):
    __tablename__ = "generations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=True)
    model_id = Column(String, ForeignKey("models.id"), nullable=True)
    scene_id = Column(String, ForeignKey("scenes.id"), nullable=True)
    
    mode = Column(String, nullable=False)  # packshot, backshot, model_poses, try_on, scene_composite
    prompt = Column(Text, nullable=False)
    settings = Column(JSON, default=dict)  # Store generation parameters
    input_image_url = Column(String, nullable=True)
    output_urls = Column(JSON, default=list)  # List of generated image URLs
    video_urls = Column(JSON, default=list)  # List of generated video URLs
    status = Column(String, default="pending")  # pending, processing, completed, failed
    credits_used = Column(Integer, default=1)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="generations")
    campaign = relationship("Campaign", back_populates="generations")
    product = relationship("Product", back_populates="generations")
    model = relationship("Model", back_populates="generations")
    scene = relationship("Scene", back_populates="generations")
