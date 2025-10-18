import io
import requests
import replicate
import uuid
import base64
import mimetypes
from PIL import Image, ImageOps, ImageFilter
from typing import Optional, List, Dict
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
import os
from dotenv import load_dotenv

# Import our modules
from database import get_db, create_tables, SessionLocal
from models import User, Campaign, Product, Model, Scene, Generation
from schemas import (
    UserCreate, UserLogin, UserResponse, Token,
    CampaignCreate, CampaignUpdate, CampaignResponse,
    ProductCreate, ProductResponse,
    ModelCreate, ModelResponse,
    SceneCreate, SceneResponse,
    GenerationRequest, GenerationResponse,
    MessageResponse
)
from auth import (
    authenticate_user, create_user, create_access_token,
    get_current_user, verify_password, get_password_hash
)
import stripe

load_dotenv()

# Set Replicate API token
os.environ["REPLICATE_API_TOKEN"] = "your_replicate_token_here"

# Configure Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "your_stripe_secret_key_here")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "pk_test_51SIbQ9P94ZYHDynVP4Ys1thiP9nFKuL0i2hRRT8s6Xa9rfCQ6q5AC7mS9d2QcN5aRPAerP6o3IyaDpeKew7e9Hyc00ESugEmqg")

app = FastAPI(title="Aura Engine API", version="1.0.0")

# Create database tables on startup
@app.on_event("startup")
async def startup_event():
    create_tables()
    
    # Clean up expired pose URLs
    db = SessionLocal()
    try:
        migrate_expired_pose_urls(db)
    finally:
        db.close()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Helpers ----------
def has_alpha(url: str) -> bool:
    """Check if image has alpha channel by examining the file"""
    try:
        if url.startswith("http://localhost:8000/static/"):
            # Local file - check directly
            filename = url.replace("http://localhost:8000/static/", "")
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
        
        # If it's a localhost URL, convert to file path
        if photo_url.startswith("http://localhost:8000/static/"):
            filename = photo_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            if os.path.exists(filepath):
                # Upload to a temporary public URL for Replicate
                import tempfile
                import shutil
                temp_file = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
                shutil.copy2(filepath, temp_file.name)
                temp_file.close()
                
                # For now, skip background removal and return original
                # TODO: Upload to a public URL service for Replicate
                print("Skipping background removal for local file, using original")
                return Image.open(filepath).convert("RGBA")
        
        out = replicate.run(
            "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
            input={"image": photo_url}
        )
        
        # Handle different return types
        if isinstance(out, str):
            resp = requests.get(out)
            resp.raise_for_status()
            return Image.open(io.BytesIO(resp.content)).convert("RGBA")
        else:
            return Image.open(io.BytesIO(out)).convert("RGBA")
    except Exception as e:
        print(f"Background removal failed: {e}")
        # Fallback to original image
        if photo_url.startswith("http://localhost:8000/static/"):
            filename = photo_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            return Image.open(filepath).convert("RGBA")
        else:
            resp = requests.get(photo_url)
            return Image.open(io.BytesIO(resp.content)).convert("RGBA")

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

def upload_png(img: Image.Image) -> str:
    """Save image locally and return URL"""
    os.makedirs("uploads", exist_ok=True)
    filename = f"product_{hash(str(img.tobytes()))}.png"
    filepath = f"uploads/{filename}"
    img.save(filepath)
    return f"http://localhost:8000/static/{filename}"

def upload_to_public_url(filepath: str) -> str:
    """Upload image to a public URL service for Replicate to access"""
    try:
        # For now, convert local file to base64 data URL for Replicate
        import base64
        import mimetypes
        
        # Get the MIME type
        mime_type, _ = mimetypes.guess_type(filepath)
        if not mime_type:
            mime_type = "image/jpeg"
        
        # Read and encode the file
        with open(filepath, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode()
            data_url = f"data:{mime_type};base64,{encoded_string}"
            print(f"Converted {filepath} to base64 data URL (length: {len(data_url)})")
            return data_url
    except Exception as e:
        print(f"Failed to convert to data URL: {e}")
        # Fallback to a public image
        return "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"

def download_and_reupload_image(expired_url: str) -> str:
    """Download an expired image and re-upload it to get a fresh URL"""
    try:
        import requests
        import uuid
        from PIL import Image
        import io
        
        print(f"🔄 Downloading expired image: {expired_url[:50]}...")
        
        # Try to download the image
        response = requests.get(expired_url, timeout=30, stream=True)
        if response.status_code != 200:
            print(f"❌ Failed to download image (status: {response.status_code})")
            return None
            
        # Save to temporary file
        temp_filename = f"temp_reupload_{uuid.uuid4().hex}.jpg"
        temp_path = f"temp/{temp_filename}"
        
        with open(temp_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        print(f"✅ Downloaded image to: {temp_path}")
        
        # Re-upload to get a fresh URL
        fresh_url = upload_to_public_url(temp_path)
        
        # Clean up temp file
        try:
            os.remove(temp_path)
        except:
            pass
            
        return fresh_url
        
    except Exception as e:
        print(f"❌ Failed to download and re-upload image: {e}")
        return None

def download_and_store_image(url: str, filename_prefix: str = "pose") -> str:
    """Download image from URL and store locally, return local URL"""
    try:
        import requests
        import uuid
        
        # Download the image
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        # Generate filename
        file_ext = os.path.splitext(url.split('?')[0])[1] or '.jpg'
        filename = f"{filename_prefix}_{uuid.uuid4().hex[:8]}{file_ext}"
        filepath = f"uploads/{filename}"
        
        # Save to local storage
        with open(filepath, 'wb') as f:
            f.write(response.content)
        
        # Return local URL
        local_url = f"http://localhost:8000/static/{filename}"
        print(f"✅ Downloaded and stored image: {local_url}")
        return local_url
        
    except Exception as e:
        print(f"❌ Failed to download and store image from {url}: {e}")
        # Return original URL as fallback
        return url

def migrate_expired_pose_urls(db: Session):
    """Clean up expired pose URLs from models"""
    try:
        print("🧹 Cleaning up expired pose URLs...")
        
        # Get all models with poses
        models = db.query(Model).filter(Model.poses.isnot(None)).all()
        
        for model in models:
            if model.poses and len(model.poses) > 0:
                # Check if any poses are Replicate URLs (which expire)
                has_expired_urls = any('replicate.delivery' in str(pose) for pose in model.poses)
                
                if has_expired_urls:
                    print(f"🧹 Clearing expired poses for model: {model.name}")
                    # Clear the poses array to force using original model image
                    model.poses = []
                    model.updated_at = datetime.utcnow()
        
        db.commit()
        print("✅ Expired pose URLs cleaned up")
        
    except Exception as e:
        print(f"❌ Failed to clean up expired pose URLs: {e}")

def download_and_store_video(video_url: str) -> Optional[str]:
    """Download a video from URL and store it locally, return the local URL"""
    try:
        import requests
        import os
        import uuid
        from urllib.parse import urlparse
        
        print(f"🔄 Downloading video from: {video_url[:100]}...")
        response = requests.get(video_url, timeout=60, stream=True)
        response.raise_for_status()
        
        # Check if it's actually a video
        content_type = response.headers.get('content-type', '').lower()
        if not content_type.startswith('video/'):
            print(f"❌ URL does not point to a video (content-type: {content_type})")
            return None
        
        # Generate unique filename
        video_id = str(uuid.uuid4())
        file_extension = '.mp4'  # Default to mp4
        if 'webm' in content_type:
            file_extension = '.webm'
        elif 'mov' in content_type:
            file_extension = '.mov'
        elif 'avi' in content_type:
            file_extension = '.avi'
        
        filename = f"video_{video_id}{file_extension}"
        filepath = f"uploads/{filename}"
        
        # Ensure uploads directory exists
        os.makedirs("uploads", exist_ok=True)
        
        # Download and save the video
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # Return the local URL
        local_url = f"http://localhost:8000/static/{filename}"
        print(f"✅ Video downloaded and stored: {local_url}")
        return local_url
        
    except Exception as e:
        print(f"❌ Failed to download and store video: {e}")
        return None

# ---------- Prompt builders ----------
PACKSHOT_BASE = ("Ultra-clean studio packshot of the uploaded product, {ANGLE} view. "
                 "Even softbox lighting on a {BG_DESC} background. "
                 "Soft contact shadow{REFLECTION_CLAUSE}. "
                 "No props, no text, no people, no watermark. Crisp edges, accurate colors.")

BACKSHOT_BASE = ("Realistic lifestyle backshot: place the uploaded product on a model/scene. "
                 "Natural, photorealistic lighting and physically plausible shadows. "
                 "Preserve exact colors and knit texture. No watermarks or extra text.")

def build_prompt(mode: str, user_mods: str, angle="front", background="white", reflection=False) -> str:
    angle_txt = {"front":"front","three_quarter":"three-quarter","side":"side","top":"top"}.get(angle,"front")
    bg_desc = {
        "white":"white seamless","light_gray":"light gray seamless",
        "transparent":"transparent (alpha)","gradient":"subtle studio gradient"
    }.get(background, "white seamless")
    reflection_clause = " with a mild floor reflection" if reflection else ""
    base = PACKSHOT_BASE if mode == "packshot" else BACKSHOT_BASE
    base = base.format(ANGLE=angle_txt, BG_DESC=bg_desc, REFLECTION_CLAUSE=reflection_clause)

    # Explicit instruction for raw photos
    extraction = ("Extract the garment from the provided photo; ignore original background. "
                  "Preserve exact knit pattern and true fabric color.")
    final = f"{base}\n\nPreprocessing: {extraction}\nRequested modifications: {user_mods.strip() or 'None'}"
    return final

def build_image_input(mode: str, product_url_or_png: str, scene_or_model_url: Optional[str]) -> List[str]:
    if mode == "packshot":
        return [product_url_or_png]
    if not scene_or_model_url:
        raise ValueError("Backshot mode requires scene_or_model_url.")
    return [product_url_or_png, scene_or_model_url]

# ---------- Main generation function ----------
def run_from_photo_or_png(
    mode: str,                              # "packshot" | "backshot"
    product_image_url: str,                 # raw photo (like your example) or PNG-with-alpha
    user_mods: str,
    angle: str = "front",
    background: str = "white",
    reflection: bool = False,
    shadow_strength: float = 0.35,
    variants: int = 4,
    scene_or_model_url: Optional[str] = None,
    extra: Optional[Dict] = None
) -> List[str]:
    """
    1) If photo → remove background → PNG alpha.
    2) Call Nano Banana on Replicate. Returns URLs.
    """
    print(f"Starting generation: {mode} mode, {variants} variants")
    
    if mode == "backshot" and scene_or_model_url:
        # Use Vella for virtual try-on
        print("Using Vella for virtual try-on generation")
        return run_vella_tryon(
            model_image_url=scene_or_model_url,
            garment_image_url=product_image_url,
            variants=variants
        )
    else:
        # Use Qwen for packshot generation
        print("Using Qwen for packshot generation")
        return run_qwen_packshot(
            product_image_url=product_image_url,
            user_mods=user_mods,
            angle=angle,
            background=background,
            reflection=reflection,
            shadow_strength=shadow_strength,
            variants=variants
        )

def run_vella_tryon(
    model_image_url: str,
    garment_image_url: str,
    variants: int = 4
) -> List[str]:
    """Use Vella for virtual try-on generation"""
    try:
        print(f"Vella try-on: model={model_image_url[:50]}..., garment={garment_image_url[:50]}...")
        
        # Convert local URLs to public URLs for Replicate
        if model_image_url.startswith("http://localhost:8000/static/"):
            filename = model_image_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            model_image_url = upload_to_public_url(filepath)
            print(f"Converted model URL: {model_image_url[:100]}...")
            
        if garment_image_url.startswith("http://localhost:8000/static/"):
            filename = garment_image_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            garment_image_url = upload_to_public_url(filepath)
            print(f"Converted garment URL: {garment_image_url[:100]}...")
        
        # Determine garment type based on image or use top as default
        garment_type = "top"  # Could be enhanced to detect garment type
        
        # Prepare input for Vella
        vella_input = {
            "model_image": model_image_url,
            f"{garment_type}_image": garment_image_url,
            "num_outputs": min(variants, 4)  # Vella supports max 4 outputs
        }
        
        print(f"Vella input: {vella_input}")
        
        # Run Vella model
        output = replicate.run("omnious/vella", input=vella_input)
        print(f"Vella output type: {type(output)}")
        
        # Handle different output formats
        if isinstance(output, list):
            print(f"Vella returned list with {len(output)} items")
            return output
        elif isinstance(output, str):
            print(f"Vella returned single string: {output[:100]}...")
            return [output]
        else:
            # If it's a single result, wrap in list
            print(f"Vella returned other type: {type(output)}")
            return [str(output)]
            
    except Exception as e:
        print(f"Vella generation failed: {e}")
        # Fallback to a placeholder
        fallback_urls = [f"https://picsum.photos/800/600?random={i+3000}" for i in range(variants)]
        print(f"Using Vella fallback URLs: {fallback_urls}")
        return fallback_urls

def run_consistent_character(
    model_image_url: str,
    prompt: str = "fashion model in different full-body poses",
    variants: int = 1
) -> List[str]:
    """Use Qwen for pose transfer and full-body generation"""
    print("=== QWEN POSE TRANSFER FULL-BODY GENERATION ===")
    print(f"Input URL: {model_image_url}")
    print(f"Prompt: {prompt}")
    print(f"Variants: {variants}")
    
    try:
        # Convert local URL to public URL for Replicate
        if model_image_url.startswith("http://localhost:8000/static/"):
            filename = model_image_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            model_image_url = upload_to_public_url(filepath)
            print(f"Converted model URL: {model_image_url[:100]}...")
        
        # Prepare input for Consistent Character
        character_input = {
            "subject": model_image_url,  # The model image
            "prompt": f"professional full-body fashion photography, {prompt}, clean background, studio lighting, high quality",
            "number_of_outputs": min(variants, 4),  # Number of images to generate
            "number_of_images_per_pose": 1,  # One image per pose
            "randomise_poses": True,  # Generate different poses
            "output_format": "webp",
            "output_quality": 80,
            "negative_prompt": "nsfw, nude, inappropriate, sexual, explicit, adult content, low quality, blurry, distorted",
            "disable_safety_checker": True,  # Disable safety checker
            "seed": 42  # Random seed for variety
        }
        
        print(f"Consistent Character input: {character_input}")
        
        # Use Qwen for pose transfer and full-body generation
        print("🎭 Using Qwen for pose transfer and full-body generation...")
        
        # Generate dynamic poses with variety
        output_urls = []
        
        # Define dynamic pose variations for more interesting poses
        dynamic_poses = [
            "dynamic walking pose, one leg forward, arms swinging naturally, confident stride, full body visible",
            "casual standing pose, one hand on hip, weight shifted to one side, relaxed but confident, full body visible", 
            "sitting pose, legs crossed elegantly, hands resting on lap, sophisticated posture, full body visible",
            "action pose, one arm raised, dynamic movement, energetic and lively, full body visible",
            "relaxed pose, leaning slightly, hands in pockets, casual and natural, full body visible",
            "fashion pose, one hand on hip, other arm extended, model-like stance, full body visible",
            "candid pose, mid-movement, natural gesture, authentic expression, full body visible",
            "power pose, both hands on hips, strong confident stance, full body visible",
            "running pose, mid-stride, arms pumping, athletic movement, full body visible",
            "dancing pose, one arm up, body twisted, graceful movement, full body visible",
            "jumping pose, both feet off ground, arms raised, energetic action, full body visible",
            "stretching pose, one arm reaching up, body extended, natural movement, full body visible",
            "pointing pose, one arm extended forward, confident gesture, full body visible",
            "thinking pose, one hand on chin, contemplative stance, full body visible",
            "celebrating pose, both arms raised, joyful expression, full body visible",
            "leaning pose, body tilted, one hand on wall, casual and relaxed, full body visible"
        ]
        
        # Shuffle poses to ensure variety when generating multiple poses
        import random
        random.shuffle(dynamic_poses)
        
        for i in range(variants):
            try:
                # Use different dynamic pose for each generation to ensure variety
                pose_description = dynamic_poses[i % len(dynamic_poses)]
                dynamic_prompt = f"{prompt}, {pose_description}, single pose only, one person, one pose, full body shot, entire body visible, studio lighting, clean background, high quality, detailed, professional fashion photography, natural movement, dynamic positioning, fluid motion, authentic expression, relaxed posture, confident stance, natural body language"
                
                print(f"🎭 Generating dynamic pose {i+1} with Qwen: {pose_description}")
                
                # Add some randomization to parameters for more variety
                random_steps = random.randint(25, 35)
                random_guidance = random.uniform(7.0, 8.0)
                
                out = replicate.run("qwen/qwen-image-edit-plus", input={
                    "prompt": dynamic_prompt,
                    "image": [model_image_url],  # Qwen expects an array of images
                    "num_inference_steps": random_steps,
                    "guidance_scale": random_guidance
                })
                
                # Handle different return types
                if hasattr(out, 'url'):
                    output_urls.append(out.url())
                elif isinstance(out, str):
                    output_urls.append(out)
                elif isinstance(out, list) and len(out) > 0:
                    item = out[0]
                    if hasattr(item, 'url'):
                        output_urls.append(item.url())
                    else:
                        output_urls.append(str(item))
                else:
                    output_urls.append(str(out))
                    
                print(f"✅ Generated single full-body pose {i+1}/{variants} with Qwen")
            
            except Exception as e:
                print(f"❌ Failed to generate pose {i+1} with Qwen: {e}")
                continue
        
        if output_urls:
            print(f"🎭 Qwen generated {len(output_urls)} single full-body pose(s)")
            return output_urls
        else:
            raise Exception("Failed to generate any poses with Qwen")
            
    except Exception as e:
        print(f"Qwen pose transfer generation failed: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to test URLs for now
        test_urls = [
            "https://replicate.delivery/xezq/tnn3QPRsf62KMinWGNf9tY6QW1CaJ8u5X9ideTUXHidsmy8qA/ComfyUI_00001_.webp",
            "https://replicate.delivery/xezq/eupN8W65j9QJLyuxSET8fI1cg5qRSNcKgfta9m5ze6saOl5VB/ComfyUI_00002_.webp"
        ]
        print(f"Using test URLs as fallback: {test_urls}")
        return test_urls[:variants]

def run_qwen_packshot(
    product_image_url: str,
    user_mods: str,
    angle: str = "front",
    background: str = "white",
    reflection: bool = False,
    shadow_strength: float = 0.35,
    variants: int = 4
) -> List[str]:
    """Use Qwen for packshot generation"""
    try:
        print("Processing product image for packshot...")
        
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
        if product_png_url.startswith("http://localhost:8000/static/"):
            filename = product_png_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            product_png_url = upload_to_public_url(filepath)
            print(f"Converted to public URL: {product_png_url[:100]}...")

        # Step 2: Build prompt and inputs
        prompt = build_prompt("packshot", user_mods, angle, background, reflection)
        print(f"Packshot prompt: {prompt[:100]}...")

        # Step 3: Generate with Qwen
        urls = []
        for i in range(max(1, variants)):
            print(f"Generating packshot variant {i+1}/{variants}...")
            try:
                out = replicate.run("qwen/qwen-image-edit-plus", input={
                    "prompt": f"{prompt}, product photography, professional lighting, studio setup, high quality, detailed",
                    "image": [product_png_url],  # Qwen expects an array of images
                    "num_inference_steps": 20,
                    "guidance_scale": 7.5
                })
                print(f"Qwen returned: {type(out)} - {str(out)[:100]}...")
                
                # Handle different return types
                if hasattr(out, 'url'):
                    url = out.url()
                elif isinstance(out, str):
                    url = out
                elif isinstance(out, list) and len(out) > 0:
                    url = out[0] if isinstance(out[0], str) else out[0].url()
                else:
                    url = str(out)
                
                print(f"Generated packshot URL: {url}")
                urls.append(url)
                
            except Exception as e:
                print(f"Error generating packshot variant {i+1}: {e}")
                # Add fallback image
                fallback_url = f"https://picsum.photos/800/600?random={i+4000}"
                print(f"Using packshot fallback: {fallback_url}")
                urls.append(fallback_url)
        
        print(f"Generated {len(urls)} packshot URLs: {urls}")
        return urls
        
    except Exception as e:
        print(f"Qwen packshot generation failed: {e}")
        # Fallback to a placeholder
        fallback_urls = [f"https://picsum.photos/800/600?random={i+5000}" for i in range(variants)]
        print(f"Using Qwen fallback URLs: {fallback_urls}")
        return fallback_urls

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
        
        # Use the base model image as starting point based on gender
        # This is the placeholder model image that will be modified
        if gender == "female":
            base_model_local_url = "http://localhost:8000/static/model_female.png"  # Female base model
        else:
            base_model_local_url = "http://localhost:8000/static/model.png"  # Male base model (default)
        
        # Convert local URL to public URL for Replicate
        if base_model_local_url.startswith("http://localhost:8000/static/"):
            filename = base_model_local_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            if os.path.exists(filepath):
                base_model_url = upload_to_public_url(filepath)
                print(f"Converted base model to public URL: {base_model_url[:100]}...")
            else:
                print(f"❌ Base model file not found: {filepath}")
                # Fallback to a default image
                base_model_url = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop"
                print(f"Using fallback base model URL: {base_model_url}")
        else:
            base_model_url = base_model_local_url
        
        generated_urls = []
        
        for i in range(variants):
            try:
                # Enhance prompt with physical attributes
                physical_description = f"{age} year old {gender}, {height} height, {build} build, {hair_color} hair, {eye_color} eyes, {skin_tone} skin tone"
                
                # Handle empty prompt - use just physical attributes
                if prompt.strip():
                    enhanced_prompt = f"Transform this person to match: {prompt}. {physical_description}. Professional fashion model, high quality, detailed, realistic, studio lighting, fashion photography"
                else:
                    enhanced_prompt = f"Transform this person to be: {physical_description}. Professional fashion model, high quality, detailed, realistic, studio lighting, fashion photography"
                
                print(f"🎭 Processing variant {i+1} with base model image...")
                
                # Run Nano Banana model generation
                out = replicate.run("google/nano-banana", input={
                    "prompt": enhanced_prompt,
                    "image_input": [base_model_url],
                    "num_inference_steps": 30,
                    "guidance_scale": 7.5,
                    "strength": 0.8,  # High strength for significant transformation
                    "shadow_strength": 0.4,
                    "seed": None  # Random seed for variety
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
                # Use fallback image if generation fails
                fallback_url = f"https://picsum.photos/512/768?random={i+1000}"
                generated_urls.append(fallback_url)
        
        print(f"✅ Nano Banana model generation completed: {len(generated_urls)} images")
        return generated_urls
        
    except Exception as e:
        print(f"❌ Nano Banana model generation error: {e}")
        # Return fallback URLs if everything fails
        fallback_urls = [f"https://picsum.photos/512/768?random={i+2000}" for i in range(variants)]
        return fallback_urls

def run_nano_banana_refinement(image_url: str, quality_mode: str = "standard") -> str:
    """Apply Nano Banana refinement to enhance the final image"""
    try:
        print(f"🍌 Running Nano Banana refinement: {image_url[:50]}...")
        
        # Convert local URLs to public URLs for Replicate
        if image_url.startswith("http://localhost:8000/static/"):
            filename = image_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            image_url = upload_to_public_url(filepath)
            print(f"Converted image to public URL: {image_url[:100]}...")
        
        # Dark luxury refinement prompt for sophisticated aesthetic
        refinement_prompt = "Place the model wearing the product naturally into this scene. The model should look realistic and well-integrated with the environment. Use soft diffused lighting with rich shadows and subtle warm highlights. Keep a deep black aesthetic with matte tones — black, charcoal, graphite, and muted neutrals — but preserve natural skin tones and ambient color reflections. Emphasize sleek textures like leather, cotton, and silk. Use cinematic contrast, shallow depth of field, and minimal composition. The mood should evoke quiet confidence, exclusivity, and refined modern luxury. Maintain professional fashion photography realism, with correct perspective, shadows, and color balance."
        
        # Configure parameters based on quality mode
        if quality_mode == "high":
            num_steps = 30
            guidance = 7.5
            strength = 0.8  # Higher strength for more dramatic dark luxury effect
            print("🎨 Using HIGH QUALITY Nano Banana mode")
        else:  # standard
            num_steps = 20
            guidance = 7.5
            strength = 0.7
            print("⚡ Using STANDARD Nano Banana quality mode")
        
        # Run Nano Banana refinement with correct parameters
        try:
            out = replicate.run("google/nano-banana", input={
                "prompt": refinement_prompt,
                "image_input": [image_url],
                "shadow_strength": 0.4,
                "num_inference_steps": num_steps,
                "guidance_scale": guidance,
                "strength": strength,  # How much to modify the image
                "seed": None  # Random seed for variety
            })
            
            # Handle different return types
            if hasattr(out, 'url'):
                refined_url = out.url()
            elif isinstance(out, str):
                refined_url = out
            elif isinstance(out, list) and len(out) > 0:
                refined_url = out[0] if isinstance(out[0], str) else out[0].url()
            else:
                refined_url = str(out)
            
            print(f"✅ Nano Banana refinement completed: {refined_url}")
            return refined_url
            
        except Exception as e:
            print(f"❌ Nano Banana refinement failed: {e}")
            # Return original image if refinement fails
            return image_url
            
    except Exception as e:
        print(f"❌ Nano Banana refinement error: {e}")
        return image_url

def upload_to_public_url(filepath: str) -> str:
    """Upload image to a public URL service for Replicate to access"""
    try:
        # Convert local file to base64 data URL for Replicate
        mime_type, _ = mimetypes.guess_type(filepath)
        if not mime_type:
            mime_type = "image/jpeg"
        
        # Read and encode the file
        with open(filepath, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode()
            data_url = f"data:{mime_type};base64,{encoded_string}"
            print(f"Converted {filepath} to base64 data URL (length: {len(data_url)})")
            return data_url
    except Exception as e:
        print(f"Failed to convert to data URL: {e}")
        return filepath

def download_and_save_image(url: str, prefix: str = "packshot") -> str:
    """Download image from URL and save it locally"""
    try:
        import requests
        from io import BytesIO
        
        print(f"Downloading image from: {url[:100]}...")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        # Open image and save
        img = Image.open(BytesIO(response.content))
        filename = f"{prefix}_{hash(url)}.{img.format.lower() if img.format else 'jpg'}"
        filepath = f"uploads/{filename}"
        
        os.makedirs("uploads", exist_ok=True)
        img.save(filepath)
        
        local_url = f"http://localhost:8000/static/{filename}"
        print(f"Saved to: {local_url}")
        return local_url
        
    except Exception as e:
        print(f"Failed to download and save image: {e}")
        return url

def run_wan_video_generation(image_url: str, video_quality: str = "480p", custom_prompt: Optional[str] = None) -> str:
    """Generate video from image using Wan 2.2 I2V Fast API"""
    try:
        print(f"🎬 Running Wan video generation: {image_url[:50]}...")
        
        # Convert local URLs to public URLs for Replicate
        if image_url.startswith("http://localhost:8000/static/"):
            filename = image_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            image_url = upload_to_public_url(filepath)
            print(f"Converted image to public URL: {image_url[:100]}...")
        
        # Configure parameters based on video quality
        if video_quality == "720p":
            num_frames = 120  # Higher frame count for 720p
            fps = 8
            print("🎨 Using 720p video quality mode")
        else:  # 480p or default
            num_frames = 81  # Minimum required for 480p
            fps = 4
            print("⚡ Using 480p video quality mode")
        
        # Validate image URL and handle expired URLs
        try:
            import requests
            print(f"🔍 Validating image URL: {image_url[:100]}...")
            # Use GET request with stream=True to check if image is actually accessible
            response = requests.get(image_url, timeout=10, stream=True)
            if response.status_code != 200:
                print(f"❌ Image URL not accessible (status: {response.status_code})")
                # Try to re-upload the image if it's a local URL
                if image_url.startswith("http://localhost:8000/static/"):
                    print(f"🔄 Attempting to re-upload local image...")
                    filename = image_url.replace("http://localhost:8000/static/", "")
                    filepath = f"uploads/{filename}"
                    if os.path.exists(filepath):
                        image_url = upload_to_public_url(filepath)
                        print(f"✅ Re-uploaded image: {image_url[:100]}...")
                    else:
                        print(f"❌ Local file not found: {filepath}")
                        return None
                else:
                    # Try to download and re-upload external expired URLs
                    print(f"🔄 Attempting to download and re-upload expired external URL...")
                    fresh_url = download_and_reupload_image(image_url)
                    if fresh_url:
                        image_url = fresh_url
                        print(f"✅ Re-uploaded external image: {image_url[:100]}...")
                    else:
                        print(f"❌ Failed to re-upload external image")
                        return None
            else:
                # Check if it's actually an image by looking at content-type
                content_type = response.headers.get('content-type', '').lower()
                if not content_type.startswith('image/'):
                    print(f"❌ URL does not point to an image (content-type: {content_type})")
                    return None
                # Try to read a small portion to ensure the image is actually downloadable
                try:
                    chunk = next(response.iter_content(chunk_size=1024), b'')
                    if len(chunk) == 0:
                        print(f"❌ Image URL returns empty content")
                        return None
                except Exception as e:
                    print(f"❌ Image URL content validation failed: {e}")
                    return None
                
                # Additional check: if it's a replicate.delivery URL, try to re-upload it
                # as these URLs often have access restrictions for Replicate API
                if "replicate.delivery" in image_url:
                    print(f"🔄 Replicate delivery URL detected, re-uploading for better compatibility...")
                    fresh_url = download_and_reupload_image(image_url)
                    if fresh_url:
                        image_url = fresh_url
                        print(f"✅ Re-uploaded for Replicate compatibility: {image_url[:100]}...")
                    else:
                        print(f"⚠️ Failed to re-upload, proceeding with original URL")
                
                print(f"✅ Image URL is accessible and valid")
        except Exception as e:
            print(f"❌ Image URL validation failed: {e}")
            # Try to re-upload if it's a local URL
            if image_url.startswith("http://localhost:8000/static/"):
                print(f"🔄 Attempting to re-upload local image after validation failure...")
                filename = image_url.replace("http://localhost:8000/static/", "")
                filepath = f"uploads/{filename}"
                if os.path.exists(filepath):
                    image_url = upload_to_public_url(filepath)
                    print(f"✅ Re-uploaded image: {image_url[:100]}...")
                else:
                    print(f"❌ Local file not found: {filepath}")
                    return None
            else:
                # Try to download and re-upload external URLs
                print(f"🔄 Attempting to download and re-upload external URL after validation failure...")
                fresh_url = download_and_reupload_image(image_url)
                if fresh_url:
                    image_url = fresh_url
                    print(f"✅ Re-uploaded external image: {image_url[:100]}...")
                else:
                    print(f"❌ Failed to re-upload external image")
                    return None
        
        # Run Wan video generation
        try:
            print(f"🎬 Calling Replicate API with image: {image_url[:100]}...")
            # Use custom prompt if provided, otherwise use default
            default_prompt = "A realistic model wearing the product, integrated naturally into the scene. Use soft diffused lighting with rich shadows and subtle warm highlights. Keep a deep black aesthetic with matte tones — black, charcoal, graphite, and muted neutrals — but preserve natural skin tones and ambient color reflections. Emphasize sleek textures like leather, cotton, and silk. Use cinematic contrast, shallow depth of field, and minimal composition. The mood should evoke quiet confidence, exclusivity, and refined modern luxury. Maintain professional fashion photography realism, with correct perspective, shadows, and color balance."
            
            prompt_to_use = custom_prompt if custom_prompt else default_prompt
            
            out = replicate.run("wan-video/wan-2.2-i2v-fast", input={
                "image": image_url,
                "prompt": prompt_to_use,
                "num_frames": num_frames,
                "fps": fps,
                "motion_intensity": 0.5,  # Moderate motion
                "seed": 42  # Fixed seed for consistency
            })
            
            print(f"🎬 Replicate API returned: {type(out)} - {out}")
            
            # Handle different return types
            if hasattr(out, 'url'):
                video_url = out.url()
            elif isinstance(out, str):
                video_url = out
            elif isinstance(out, list) and len(out) > 0:
                video_url = out[0] if isinstance(out[0], str) else out[0].url()
            else:
                video_url = str(out)
            
            print(f"✅ Wan video generation completed: {video_url}")
            
            # Download and store the video locally to prevent URL expiry
            local_video_url = download_and_store_video(video_url)
            if local_video_url:
                print(f"✅ Video stored locally: {local_video_url}")
                return local_video_url
            else:
                print(f"⚠️ Failed to store video locally, using original URL")
            return video_url
            
        except Exception as e:
            print(f"❌ Wan video generation failed: {e}")
            import traceback
            traceback.print_exc()
            # Return None if video generation fails (not critical)
            return None
            
    except Exception as e:
        print(f"❌ Wan video generation error: {e}")
        return None

def run_seedance_video_generation(image_url: str, video_quality: str = "480p", duration: str = "5s", custom_prompt: Optional[str] = None) -> str:
    """Generate video from image using Seedance 1 Pro API"""
    try:
        print(f"🎬 Running Seedance 1 Pro video generation: {image_url[:50]}...")
        
        # Convert local URLs to public URLs for Replicate
        if image_url.startswith("http://localhost:8000/static/"):
            filename = image_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            image_url = upload_to_public_url(filepath)
            print(f"Converted image to public URL: {image_url[:100]}...")
        
        # Configure parameters based on video quality and duration
        if video_quality == "1080p":
            resolution = "1080p"
            print("🎨 Using 1080p video quality mode")
        else:  # 480p or default
            resolution = "480p"
            print("⚡ Using 480p video quality mode")
        
        # Validate image URL and handle expired URLs (reuse the same validation logic)
        try:
            import requests
            print(f"🔍 Validating image URL: {image_url[:100]}...")
            response = requests.get(image_url, timeout=10, stream=True)
            if response.status_code != 200:
                print(f"❌ Image URL not accessible (status: {response.status_code})")
                # Try to re-upload the image if it's a local URL
                if image_url.startswith("http://localhost:8000/static/"):
                    print(f"🔄 Attempting to re-upload local image...")
                    filename = image_url.replace("http://localhost:8000/static/", "")
                    filepath = f"uploads/{filename}"
                    if os.path.exists(filepath):
                        image_url = upload_to_public_url(filepath)
                        print(f"✅ Re-uploaded image: {image_url[:100]}...")
                    else:
                        print(f"❌ Local file not found: {filepath}")
                        return None
                else:
                    # Try to download and re-upload external expired URLs
                    print(f"🔄 Attempting to download and re-upload expired external URL...")
                    fresh_url = download_and_reupload_image(image_url)
                    if fresh_url:
                        image_url = fresh_url
                        print(f"✅ Re-uploaded external image: {image_url[:100]}...")
                    else:
                        print(f"❌ Failed to re-upload external image")
                        return None
            else:
                # Check if it's actually an image by looking at content-type
                content_type = response.headers.get('content-type', '').lower()
                if not content_type.startswith('image/'):
                    print(f"❌ URL does not point to an image (content-type: {content_type})")
                    return None
                # Try to read a small portion to ensure the image is actually downloadable
                try:
                    chunk = next(response.iter_content(chunk_size=1024), b'')
                    if len(chunk) == 0:
                        print(f"❌ Image URL returns empty content")
                        return None
                except Exception as e:
                    print(f"❌ Image URL content validation failed: {e}")
                    return None
                
                # Additional check: if it's a replicate.delivery URL, try to re-upload it
                if "replicate.delivery" in image_url:
                    print(f"🔄 Replicate delivery URL detected, re-uploading for better compatibility...")
                    fresh_url = download_and_reupload_image(image_url)
                    if fresh_url:
                        image_url = fresh_url
                        print(f"✅ Re-uploaded for Replicate compatibility: {image_url[:100]}...")
                    else:
                        print(f"⚠️ Failed to re-upload, proceeding with original URL")
                
                print(f"✅ Image URL is accessible and valid")
        except Exception as e:
            print(f"❌ Image URL validation failed: {e}")
            # Try to re-upload if it's a local URL
            if image_url.startswith("http://localhost:8000/static/"):
                print(f"🔄 Attempting to re-upload local image after validation failure...")
                filename = image_url.replace("http://localhost:8000/static/", "")
                filepath = f"uploads/{filename}"
                if os.path.exists(filepath):
                    image_url = upload_to_public_url(filepath)
                    print(f"✅ Re-uploaded image: {image_url[:100]}...")
                else:
                    print(f"❌ Local file not found: {filepath}")
                    return None
            else:
                # Try to download and re-upload external URLs
                print(f"🔄 Attempting to download and re-upload external URL after validation failure...")
                fresh_url = download_and_reupload_image(image_url)
                if fresh_url:
                    image_url = fresh_url
                    print(f"✅ Re-uploaded external image: {image_url[:100]}...")
                else:
                    print(f"❌ Failed to re-upload external image")
                    return None
        
        # Run Seedance 1 Pro video generation
        try:
            print(f"🎬 Calling Seedance 1 Pro API with image: {image_url[:100]}...")
            # Use custom prompt if provided, otherwise use default
            default_prompt = "A realistic model wearing the product, integrated naturally into the scene. Use soft diffused lighting with rich shadows and subtle warm highlights. Keep a deep black aesthetic with matte tones — black, charcoal, graphite, and muted neutrals — but preserve natural skin tones and ambient color reflections. Emphasize sleek textures like leather, cotton, and silk. Use cinematic contrast, shallow depth of field, and minimal composition. The mood should evoke quiet confidence, exclusivity, and refined modern luxury. Maintain professional fashion photography realism, with correct perspective, shadows, and color balance."
            
            prompt_to_use = custom_prompt if custom_prompt else default_prompt
            
            out = replicate.run("bytedance/seedance-1-pro", input={
                "image": image_url,
                "prompt": prompt_to_use,
                "resolution": resolution,
                "duration": duration,
                "seed": 42  # Fixed seed for consistency
            })
            
            print(f"🎬 Seedance 1 Pro API returned: {type(out)} - {out}")
            
            # Handle different return types
            if hasattr(out, 'url'):
                video_url = out.url()
            elif isinstance(out, str):
                video_url = out
            elif isinstance(out, list) and len(out) > 0:
                video_url = out[0] if isinstance(out[0], str) else out[0].url()
            else:
                video_url = str(out)
            
            print(f"✅ Seedance 1 Pro video generation completed: {video_url}")
            
            # Download and store the video locally to prevent URL expiry
            local_video_url = download_and_store_video(video_url)
            if local_video_url:
                print(f"✅ Video stored locally: {local_video_url}")
                return local_video_url
            else:
                print(f"⚠️ Failed to store video locally, using original URL")
                return video_url
            
        except Exception as e:
            print(f"❌ Seedance 1 Pro video generation failed: {e}")
            import traceback
            traceback.print_exc()
            # Return None if video generation fails (not critical)
            return None
            
    except Exception as e:
        print(f"❌ Seedance 1 Pro video generation error: {e}")
        return None

def run_vella_try_on_with_labels(model_image_url: str, products_by_type: dict, quality_mode: str = "standard") -> str:
    """
    Apply virtual try-on using Vella API with label-based clothing system.
    
    This function applies clothing items based on their clothing_type labels:
    - Only one item per clothing type (e.g., one tshirt, one pants, one jacket)
    - Items are applied in logical order (underwear -> shirts -> pants -> outerwear)
    - Each application replaces the previous item of the same type
    
    Args:
        model_image_url: The model image to apply clothing to
        products_by_type: Dict mapping clothing_type to product image URL
                         e.g., {"tshirt": "url1", "pants": "url2", "jacket": "url3"}
        quality_mode: Quality setting for generation
    
    Returns:
        Final image URL with all clothing applied
    """
    try:
        print(f"🎭 Running label-based Vella try-on with {len(products_by_type)} clothing types...")
        
        # Define the order of clothing application (from inner to outer layers)
        clothing_order = [
            "underwear", "socks", "shoes",  # Base layer
            "tshirt", "shirt", "tank_top",  # Upper body base
            "pants", "shorts", "skirt",     # Lower body
            "sweater", "hoodie", "cardigan", # Upper body outer
            "jacket", "coat", "blazer",     # Outer layer
            "accessories", "hat", "scarf"   # Accessories
        ]
        
        current_image_url = model_image_url
        
        # Apply clothing in the defined order
        for clothing_type in clothing_order:
            if clothing_type in products_by_type:
                product_url = products_by_type[clothing_type]
                print(f"👕 Applying {clothing_type}: {product_url[:50]}...")
                
                # Convert local URLs to public URLs for Replicate
                if current_image_url.startswith("http://localhost:8000/static/"):
                    filename = current_image_url.replace("http://localhost:8000/static/", "")
                    filepath = f"uploads/{filename}"
                    current_image_url = upload_to_public_url(filepath)
                
                if product_url.startswith("http://localhost:8000/static/"):
                    filename = product_url.replace("http://localhost:8000/static/", "")
                    filepath = f"uploads/{filename}"
                    product_url = upload_to_public_url(filepath)
                
                # Apply the clothing item
                try:
                    out = replicate.run("omnious/vella", input={
                        "model_image": current_image_url,
                        "garment_image": product_url,
                        "strength": 0.9,  # High strength to replace existing clothing
                        "guidance_scale": 8.0,  # High guidance for better adherence
                        "num_inference_steps": 50,  # High quality
                        "enable_face_restore": False,  # Focus on clothing
                        "enable_prompt_breast": False,  # Focus on clothing
                        "seed": None
                    })
                    
                    # Handle different return types
                    if hasattr(out, 'url'):
                        current_image_url = out.url()
                    elif isinstance(out, str):
                        current_image_url = out
                    elif isinstance(out, list) and len(out) > 0:
                        item = out[0]
                        if hasattr(item, 'url'):
                            current_image_url = item.url()
                        else:
                            current_image_url = str(item)
                    else:
                        current_image_url = str(out)
                    
                    print(f"✅ Applied {clothing_type} successfully")
                    
                except Exception as e:
                    print(f"❌ Failed to apply {clothing_type}: {e}")
                    # Continue with other clothing items
                    continue
        
        # Download and store the final result locally
        final_local_url = download_and_store_image(current_image_url, f"labeled_tryon_{hash(str(products_by_type)) % 10000}")
        print(f"✅ Label-based try-on completed: {final_local_url[:50]}...")
        return final_local_url
        
    except Exception as e:
        print(f"❌ Label-based try-on failed: {e}")
        # Fallback to original model image
        return model_image_url

def run_vella_try_on(model_image_url: str, product_image_url: str, quality_mode: str = "standard") -> str:
    """
    Apply virtual try-on using Vella API with aggressive clothing replacement.
    
    This function ensures the model ONLY wears the selected product by:
    1. Using high strength (0.9-0.95) to completely replace existing clothing
    2. Using high guidance scale (8.0-8.5) for better adherence to the garment
    3. Disabling face restoration and other enhancements to focus on clothing
    4. Using high inference steps for better quality
    
    If this approach doesn't work well enough, consider:
    - Using a different virtual try-on model
    - Pre-processing the model image to remove existing clothing
    - Using inpainting to remove clothing before applying new garments
    """
    try:
        print(f"🎭 Running Vella try-on: model={model_image_url[:50]}..., product={product_image_url[:50]}...")
        
        # Convert local URLs to public URLs for Replicate (skip validation for local URLs)
        if model_image_url.startswith("http://localhost:8000/static/"):
            filename = model_image_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            model_image_url = upload_to_public_url(filepath)
            print(f"Converted model to public URL: {model_image_url[:100]}...")
        elif not model_image_url.startswith("data:"):
            # Only validate non-local, non-data URLs
            try:
                import requests
                model_test = requests.head(model_image_url, timeout=3)
                if model_test.status_code != 200:
                    print(f"⚠️ Model image URL not accessible ({model_test.status_code}), using fallback")
                    fallback_url = f"https://picsum.photos/800/600?random={hash(model_image_url + product_image_url) % 10000}"
                    return fallback_url
            except Exception as e:
                print(f"⚠️ Model image URL validation failed ({e}), using fallback")
                fallback_url = f"https://picsum.photos/800/600?random={hash(model_image_url + product_image_url) % 10000}"
                return fallback_url
        
        if product_image_url.startswith("http://localhost:8000/static/"):
            filename = product_image_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            product_image_url = upload_to_public_url(filepath)
            print(f"Converted product to public URL: {product_image_url[:100]}...")

        # Run Vella try-on
        try:
            # Configure Vella parameters for optimal clothing application
            # Higher strength and guidance to ensure complete clothing replacement
            if quality_mode == "high":
                num_steps = 50
                guidance_scale = 8.5  # Higher guidance for better adherence to garment
                strength = 0.95  # Very high strength to ensure complete clothing replacement
                print("🎨 Using HIGH QUALITY Vella mode with aggressive clothing replacement")
            else:  # standard
                num_steps = 30
                guidance_scale = 8.0  # Higher guidance for better adherence to garment
                strength = 0.9  # High strength to ensure complete clothing replacement
                print("⚡ Using STANDARD Vella quality mode with aggressive clothing replacement")
            
            print(f"🎭 Calling Vella API with model: {model_image_url[:50]}... and product: {product_image_url[:50]}...")
            print(f"🎭 Vella parameters: steps={num_steps}, guidance={guidance_scale}, strength={strength}")
            
            # Use more aggressive parameters to ensure complete clothing replacement
            vella_input = {
                "model_image": model_image_url,
                "garment_image": product_image_url,
                "num_inference_steps": num_steps,
                "guidance_scale": guidance_scale,
                "strength": strength,
                # Additional parameters for better clothing replacement
                "enable_face_restore": False,  # Disable face restoration to focus on clothing
                "enable_prompt_breast": False,  # Disable breast enhancement to focus on clothing
            }
            
            print(f"🎭 Vella input parameters: {vella_input}")
            out = replicate.run("omnious/vella", input=vella_input)
            
            print(f"🎭 Vella API response type: {type(out)}")
            if hasattr(out, '__dict__'):
                print(f"🎭 Vella response attributes: {list(out.__dict__.keys())}")
            
            # Handle different return types
            if hasattr(out, 'url'):
                try_on_url = out.url()
            elif isinstance(out, str):
                try_on_url = out
            elif isinstance(out, list) and len(out) > 0:
                try_on_url = out[0] if isinstance(out[0], str) else out[0].url()
            else:
                try_on_url = str(out)
            
            print(f"✅ Vella try-on completed: {try_on_url}")
            return try_on_url
            
        except Exception as e:
            print(f"❌ Vella try-on failed: {e}")
            # Fallback to a placeholder - in production, you might want to try a different model
            # or implement a different virtual try-on approach
            fallback_url = f"https://picsum.photos/800/600?random={hash(model_image_url + product_image_url) % 10000}"
            print(f"Using Vella fallback URL: {fallback_url}")
            return fallback_url
        
    except Exception as e:
        print(f"❌ Vella try-on generation failed: {e}")
        # Fallback to a placeholder
        fallback_url = f"https://picsum.photos/800/600?random={hash(model_image_url + product_image_url) % 10000}"
        print(f"Using Vella fallback URL: {fallback_url}")
        return fallback_url

def run_qwen_scene_composition(try_on_image_url: str, scene_image_url: str, quality_mode: str = "standard") -> str:
    """Place try-on model into scene using a better approach"""
    try:
        print(f"🎬 Running scene composition: try-on={try_on_image_url[:50]}..., scene={scene_image_url[:50]}...")
        
        # Convert local URLs to public URLs for Replicate
        if try_on_image_url.startswith("http://localhost:8000/static/"):
            filename = try_on_image_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            try_on_image_url = upload_to_public_url(filepath)
            print(f"Converted try-on to public URL: {try_on_image_url[:100]}...")
        
        if scene_image_url.startswith("http://localhost:8000/static/"):
            filename = scene_image_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            scene_image_url = upload_to_public_url(filepath)
            print(f"Converted scene to public URL: {scene_image_url[:100]}...")

        # Use a dark luxury aesthetic prompt for scene integration
        scene_prompt = f"Compose a dark luxury fashion photograph by placing the person from the first image into the background scene from the second image. Apply a sophisticated black aesthetic with deep shadows, muted tones, and dramatic lighting. Keep the clothing exactly as shown - do not modify colors, textures, or fit. Transform the background scene to match a dark luxury aesthetic: deep blacks, charcoal grays, and subtle warm highlights. Use cinematic contrast, shallow depth of field, and minimal composition. The mood should evoke quiet confidence, exclusivity, and refined modern luxury. Make the background scene prominent but maintain the dark aesthetic throughout. Professional fashion photography with a black luxury theme."
        
        # Configure parameters for better scene integration
        if quality_mode == "high":
            num_steps = 25
            guidance = 7.5  # Higher guidance for better scene integration
            strength = 0.6  # Higher strength for better scene blending
            print("🎨 Using HIGH QUALITY mode for scene composition")
        else:  # standard
            num_steps = 15
            guidance = 5.0  # Higher guidance for better scene integration
            strength = 0.5  # Higher strength for better scene blending
            print("⚡ Using STANDARD quality mode for scene composition")
        
        # Use Qwen with improved parameters for better scene composition
        try:
            print("🔄 Using Qwen for scene composition with improved parameters...")
            out = replicate.run("qwen/qwen-image-edit-plus", input={
                "prompt": scene_prompt,
                "image": [try_on_image_url, scene_image_url],
                "num_inference_steps": num_steps,
                "guidance_scale": guidance,
                "strength": strength
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
            
            print(f"✅ Qwen scene composition completed: {scene_composite_url}")
            return scene_composite_url
            
        except Exception as e:
            print(f"❌ Qwen scene composition failed: {e}")
            # Fallback to a placeholder
            fallback_url = f"https://picsum.photos/800/600?random={hash(try_on_image_url + scene_image_url) % 10000}"
            print(f"Using scene composition fallback URL: {fallback_url}")
            return fallback_url
        
    except Exception as e:
        print(f"❌ Scene composition generation failed: {e}")
        # Fallback to a placeholder
        fallback_url = f"https://picsum.photos/800/600?random={hash(try_on_image_url + scene_image_url) % 10000}"
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
        if product_png_url.startswith("http://localhost:8000/static/"):
            filename = product_png_url.replace("http://localhost:8000/static/", "")
            filepath = f"uploads/{filename}"
            product_png_url = upload_to_public_url(filepath)
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
            
        except Exception as e:
            print(f"Error generating front packshot: {e}")
            front_url = f"https://picsum.photos/800/600?random=6001"

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
            
        except Exception as e:
            print(f"Error generating back packshot: {e}")
            back_url = f"https://picsum.photos/800/600?random=6002"

        packshot_urls = [front_url, back_url]
        print(f"Generated {len(packshot_urls)} packshot URLs: {packshot_urls}")
        return packshot_urls
        
    except Exception as e:
        print(f"Qwen front/back packshot generation failed: {e}")
        # Fallback to placeholders
        fallback_urls = [
            f"https://picsum.photos/800/600?random=7001",  # Front
            f"https://picsum.photos/800/600?random=7002"   # Back
        ]
        print(f"Using Qwen fallback URLs: {fallback_urls}")
        return fallback_urls

# ---------- Authentication Endpoints ----------
@app.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = create_user(db, user_data.email, user_data.password, user_data.full_name)
    
    # Create access token
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(
        data={"sub": user.id, "email": user.email}, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user)
    }

@app.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    user = authenticate_user(db, user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(
        data={"sub": user.id, "email": user.email}, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user)
    }

@app.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current user information"""
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return UserResponse.model_validate(user)

# ---------- Payment Endpoints ----------
@app.get("/payments/config")
async def get_payment_config():
    """Get Stripe publishable key for frontend"""
    return {"publishable_key": STRIPE_PUBLISHABLE_KEY}

@app.post("/payments/create-intent")
async def create_payment_intent(
    amount: int,  # Amount in cents
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe payment intent for credit purchase"""
    try:
        # Validate amount (minimum $1, maximum $1000)
        if amount < 100 or amount > 100000:
            raise HTTPException(
                status_code=400,
                detail="Amount must be between $1.00 and $1000.00"
            )
        
        # Calculate credits (1 credit = $0.10, so $1 = 10 credits)
        credits_to_add = amount // 10
        
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
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/payments/confirm")
async def confirm_payment(
    payment_intent_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Confirm payment and add credits to user account"""
    try:
        # Retrieve payment intent from Stripe
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
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
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    print(f"User: {current_user}")
    
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
        print(f"Calling run_nano_banana_model_generation with prompt: {prompt}, gender: {gender}")
        model_urls = run_nano_banana_model_generation(
            prompt, variants, gender, age, height, build, hair_color, eye_color, skin_tone
        )
        print(f"Got model URLs: {model_urls}")
        
        # Download and store model images locally
        local_model_urls = []
        for i, model_url in enumerate(model_urls):
            try:
                local_url = download_and_store_image(model_url, f"generated_model_{i+1}")
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
                gender=gender,  # Set the gender from the form data
                poses=[]  # Start with no poses
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
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/models/generate-poses")
async def generate_model_poses(
    model_image_url: str = Form(...),
    prompt: str = Form("fashion model in different poses"),
    variants: int = Form(4),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate different poses of the same model using Consistent Character"""
    print("=== POSE GENERATION ENDPOINT CALLED ===")
    print(f"Model image URL: {model_image_url}")
    print(f"Prompt: {prompt}")
    print(f"Variants: {variants}")
    print(f"User: {current_user}")
    try:
        # Check user credits
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        credits_needed = variants
        if user.credits < credits_needed:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient credits. You have {user.credits} credits, but need {credits_needed}"
            )
        
        # Use the provided model image URL directly
        model_url = model_image_url
        print(f"Using model URL: {model_url}")
        
        # Generate different poses
        print(f"Calling run_consistent_character with URL: {model_url}")
        # Ensure the prompt includes full-body specification
        full_body_prompt = prompt if "full-body" in prompt.lower() else f"fashion model in different full-body poses, professional photography, clean background, studio lighting, high quality, {prompt}"
        
        pose_urls = run_consistent_character(
            model_image_url=model_url,
            prompt=full_body_prompt,
            variants=variants
        )
        print(f"Got pose URLs: {pose_urls}")
        
        # Download and store pose images locally to avoid URL expiration
        local_pose_urls = []
        for i, pose_url in enumerate(pose_urls):
            try:
                local_url = download_and_store_image(pose_url, f"pose_{i+1}")
                local_pose_urls.append(local_url)
            except Exception as e:
                print(f"⚠️ Failed to download pose {i+1}, using original URL: {e}")
                local_pose_urls.append(pose_url)
        
        print(f"Stored local pose URLs: {local_pose_urls}")
        
        # Find or create the model record
        # Extract model name from the URL or use a default
        model_name = "Generated Model"  # Default name
        if "Julian_model" in model_url:
            model_name = "Julian"
        elif "model.jpg" in model_url:
            model_name = "Model"
        
        # Try to find existing model by name and user
        model = db.query(Model).filter(
            Model.user_id == user.id,
            Model.name == model_name
        ).first()
        
        if not model:
            # Create new model record
            model = Model(
                user_id=user.id,
                name=model_name,
                description=f"Model with generated poses",
                image_url=model_url,
                gender=prompt.split()[0] if prompt.split()[0] in ["male", "female"] else "male",
                poses=local_pose_urls
            )
            db.add(model)
        else:
            # Update existing model with new poses
            existing_poses = model.poses or []
            model.poses = existing_poses + local_pose_urls
            model.updated_at = datetime.utcnow()
        
        db.commit()
        
        # Deduct credits from user
        user.credits -= credits_needed
        
        # Create generation record
        generation = Generation(
            user_id=user.id,
            model_id=model.id,
            mode="model_poses",
            prompt=f"Model poses generation: {prompt}",
            settings={
                "prompt": prompt,
                "variants": variants,
                "model_url": model_url
            },
            input_image_url=model_url,
            output_urls=local_pose_urls,
            status="completed",
            credits_used=credits_needed,
            completed_at=datetime.utcnow()
        )
        db.add(generation)
        db.commit()
        
        return {
            "urls": local_pose_urls,
            "generation_id": generation.id,
            "credits_remaining": user.credits,
            "model_id": model.id,
            "model_name": model.name,
            "total_poses": len(model.poses)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/models/upload", response_model=ModelResponse)
async def upload_model(
    name: str = Form(...),
    description: str = Form(""),
    gender: str = Form(""),
    model_image: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a new model"""
    try:
        # Save uploaded image
        os.makedirs("uploads", exist_ok=True)
        filename = f"model_{hash(str(name + str(datetime.utcnow())))}.jpg"
        filepath = f"uploads/{filename}"
        
        with open(filepath, "wb") as buffer:
            content = await model_image.read()
            buffer.write(content)
        
        model_url = f"http://localhost:8000/static/{filename}"
        
        # Create model record
        model = Model(
            user_id=current_user["user_id"],
            name=name,
            description=description,
            image_url=model_url,
            gender=gender,
            poses=[]
        )
        db.add(model)
        db.commit()
        db.refresh(model)
        
        print(f"✅ Model uploaded: {name}")
        return model
        
    except Exception as e:
        print(f"❌ Model upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models", response_model=List[ModelResponse])
async def get_models(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all models for the current user"""
    models = db.query(Model).filter(Model.user_id == current_user["user_id"]).all()
    print(f"📋 Returning {len(models)} models for user {current_user['user_id']}")
    for model in models:
        print(f"  - {model.name}: {len(model.poses) if model.poses else 0} poses")
    return models

@app.get("/models/{model_id}", response_model=ModelResponse)
async def get_model(
    model_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific model by ID"""
    model = db.query(Model).filter(
        Model.id == model_id,
        Model.user_id == current_user["user_id"]
    ).first()
    
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    return model

@app.put("/models/{model_id}", response_model=ModelResponse)
async def update_model(
    model_id: str,
    name: str = Form(...),
    description: str = Form(""),
    gender: str = Form("male"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a model's name and description"""
    model = db.query(Model).filter(
        Model.id == model_id,
        Model.user_id == current_user["user_id"]
    ).first()
    
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # Update model
    model.name = name
    model.description = description
    model.gender = gender
    model.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(model)
    
    return model

@app.delete("/models/{model_id}")
async def delete_model(
    model_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a model"""
    model = db.query(Model).filter(
        Model.id == model_id,
        Model.user_id == current_user["user_id"]
    ).first()
    
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # Delete associated generations
    db.query(Generation).filter(Generation.model_id == model_id).delete()
    
    # Delete the model
    db.delete(model)
    db.commit()
    
    return {"message": "Model deleted successfully"}

@app.delete("/models/{model_id}/poses/{pose_index}")
async def delete_model_pose(
    model_id: str,
    pose_index: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a specific pose from a model"""
    model = db.query(Model).filter(
        Model.id == model_id,
        Model.user_id == current_user["user_id"]
    ).first()
    
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    if not model.poses or pose_index < 0 or pose_index >= len(model.poses):
        raise HTTPException(status_code=400, detail="Invalid pose index")
    
    # Remove the pose at the specified index
    print(f"🗑️ Deleting pose {pose_index} from model {model.name}")
    print(f"📊 Poses before deletion: {len(model.poses)}")
    
    # Create a new list without the deleted pose to ensure SQLAlchemy detects the change
    new_poses = [pose for i, pose in enumerate(model.poses) if i != pose_index]
    model.poses = new_poses
    print(f"📊 Poses after deletion: {len(model.poses)}")
    model.updated_at = datetime.utcnow()
    
    # Force SQLAlchemy to detect the change by marking the field as modified
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(model, "poses")
    
    db.commit()
    db.refresh(model)
    
    print(f"✅ Model {model.name} now has {len(model.poses)} poses")
    return {"message": f"Pose {pose_index + 1} deleted successfully", "remaining_poses": len(model.poses)}

@app.post("/products/upload", response_model=ProductResponse)
async def upload_product_with_packshots(
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form(""),
    clothing_type: str = Form(""),  # "tshirt", "pants", "sweater", "jacket", "shoes", etc.
    tags: str = Form(""),  # Comma-separated tags
    product_image: UploadFile = File(...),
    packshot_front: Optional[UploadFile] = File(None),
    packshot_back: Optional[UploadFile] = File(None),
    packshot_front_type: str = Form("front"),
    packshot_back_type: str = Form("back"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a product with optional packshot uploads or auto-generation"""
    try:
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Save uploaded product image
        os.makedirs("uploads", exist_ok=True)
        filename = f"product_{hash(str(name + str(datetime.utcnow())))}.jpg"
        filepath = f"uploads/{filename}"
        
        with open(filepath, "wb") as buffer:
            content = await product_image.read()
            buffer.write(content)
        
        product_url = f"http://localhost:8000/static/{filename}"
        
        # Parse tags from comma-separated string
        tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()] if tags else []
        
        # Initialize packshot variables
        packshot_front_url = None
        packshot_back_url = None
        packshot_front_type = None
        packshot_back_type = None
        packshot_urls = []
        credits_needed = 0
        
        # Handle uploaded packshots
        if packshot_front:
            # Save front packshot
            front_filename = f"packshot_front_{hash(str(name + str(datetime.utcnow())))}.jpg"
            front_filepath = f"uploads/{front_filename}"
            
            with open(front_filepath, "wb") as buffer:
                content = await packshot_front.read()
                buffer.write(content)
            
            packshot_front_url = f"http://localhost:8000/static/{front_filename}"
            packshot_front_type = packshot_front_type
            packshot_urls.append(packshot_front_url)
            print(f"✅ Uploaded front packshot: {packshot_front_url}")
        
        if packshot_back:
            # Save back packshot
            back_filename = f"packshot_back_{hash(str(name + str(datetime.utcnow())))}.jpg"
            back_filepath = f"uploads/{back_filename}"
            
            with open(back_filepath, "wb") as buffer:
                content = await packshot_back.read()
                buffer.write(content)
            
            packshot_back_url = f"http://localhost:8000/static/{back_filename}"
            packshot_back_type = packshot_back_type
            packshot_urls.append(packshot_back_url)
            print(f"✅ Uploaded back packshot: {packshot_back_url}")
        
        # If no packshots uploaded, auto-generate them
        if not packshot_front and not packshot_back:
            credits_needed = 2  # Generate 2 packshot variants (front + back)
            if user.credits < credits_needed:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Insufficient credits. You have {user.credits} credits, but need {credits_needed} for packshot generation"
                )
            
            print(f"🎯 Auto-generating packshots for product: {name}")
            packshot_urls = run_qwen_packshot_front_back(
                product_image_url=product_url,
                user_mods="professional product photography, clean background, studio lighting"
            )
            print(f"✅ Auto-generated {len(packshot_urls)} packshots for {name}")
        
        # Create product record
        product = Product(
            user_id=user.id,
            name=name,
            description=description,
            image_url=product_url,
            category=category,
            clothing_type=clothing_type,
            tags=tag_list,
            packshots=packshot_urls,
            packshot_front_url=packshot_front_url,
            packshot_back_url=packshot_back_url,
            packshot_front_type=packshot_front_type,
            packshot_back_type=packshot_back_type
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        
        # Deduct credits if auto-generated
        if credits_needed > 0:
            user.credits -= credits_needed
            db.commit()
        
        # Create generation record for auto-generated packshots
        generation = Generation(
            user_id=user.id,
            product_id=product.id,
            mode="packshot",
            prompt=f"Auto-generated packshots for product: {name}",
            settings={
                "auto_generated": True,
                "variants": 2,
                "product_name": name,
                "packshot_types": ["front", "back"]
            },
            input_image_url=product_url,
            output_urls=packshot_urls,
            status="completed",
            credits_used=credits_needed,
            completed_at=datetime.utcnow()
        )
        db.add(generation)
        db.commit()
        
        return product
        
    except Exception as e:
        print(f"❌ Product upload with packshots failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/products", response_model=List[ProductResponse])
async def get_products(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all products for the current user"""
    products = db.query(Product).filter(Product.user_id == current_user["user_id"]).all()
    return products

@app.get("/products/categories")
async def get_product_categories():
    """Get available product categories and common tags"""
    return {
        "categories": [
            {"value": "clothes", "label": "Clothes", "subcategories": ["tops", "pants", "jumpers", "dresses", "shirts", "jackets", "shorts", "skirts"]},
            {"value": "accessories", "label": "Accessories", "subcategories": ["caps", "hats", "bags", "belts", "watches", "jewelry", "sunglasses", "scarves"]},
            {"value": "objects", "label": "Objects", "subcategories": ["sports", "electronics", "furniture", "decor", "tools", "books", "toys", "instruments"]}
        ],
        "common_tags": [
            "casual", "formal", "sporty", "vintage", "modern", "minimalist", "colorful", "neutral",
            "summer", "winter", "spring", "fall", "indoor", "outdoor", "work", "party", "travel",
            "comfortable", "stylish", "trendy", "classic", "unique", "affordable", "premium"
        ]
    }

@app.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form(""),
    tags: str = Form(""),  # Comma-separated tags
    product_image: UploadFile = File(None),  # Optional new image
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing product"""
    try:
        # Find the product
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.user_id == current_user["user_id"]
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Update basic fields
        product.name = name
        product.description = description
        product.category = category
        
        # Parse tags from comma-separated string
        tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()] if tags else []
        product.tags = tag_list
        
        # Update image if provided
        if product_image:
            # Save new uploaded product image
            os.makedirs("uploads", exist_ok=True)
            filename = f"product_{hash(str(name + str(datetime.utcnow())))}.jpg"
            filepath = f"uploads/{filename}"
            
            with open(filepath, "wb") as buffer:
                content = await product_image.read()
                buffer.write(content)
            
            product.image_url = f"http://localhost:8000/static/{filename}"
        
        product.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(product)
        
        print(f"✅ Product updated: {product.name}")
        return product
        
    except Exception as e:
        print(f"❌ Product update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a product and all associated data"""
    try:
        # Find the product
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.user_id == current_user["user_id"]
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Delete associated generations
        db.query(Generation).filter(Generation.product_id == product_id).delete()
        
        # Delete the product
        db.delete(product)
        db.commit()
        
        print(f"✅ Product deleted: {product.name}")
        return {"message": "Product deleted successfully"}
        
    except Exception as e:
        print(f"❌ Product deletion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/products/{product_id}/reroll-packshots")
async def reroll_packshots(
    product_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Re-roll packshots for a specific product"""
    try:
        # Check user credits
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        credits_needed = 2  # Generate 2 packshot variants (front + back)
        if user.credits < credits_needed:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient credits. You have {user.credits} credits, but need {credits_needed} for packshot generation"
            )
        
        # Find the product
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.user_id == current_user["user_id"]
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Generate new packshots
        print(f"🎯 Re-rolling packshots for product: {product.name}")
        new_packshot_urls = run_qwen_packshot_front_back(
            product_image_url=product.image_url,
            user_mods="professional product photography, clean background, studio lighting"
        )
        
        # Update product with new packshot URLs
        product.packshots = new_packshot_urls
        if len(new_packshot_urls) >= 2:
            product.packshot_front_url = new_packshot_urls[0]
            product.packshot_back_url = new_packshot_urls[1]
            product.packshot_front_type = "front"
            product.packshot_back_type = "back"
        elif len(new_packshot_urls) >= 1:
            product.packshot_front_url = new_packshot_urls[0]
            product.packshot_front_type = "front"
        db.commit()
        
        # Deduct credits
        user.credits -= credits_needed
        db.commit()
        
        # Create generation record
        generation = Generation(
            user_id=user.id,
            product_id=product.id,
            mode="packshot_reroll",
            prompt=f"Re-rolled packshots for product: {product.name}",
            settings={
                "reroll": True,
                "variants": 2,
                "product_name": product.name,
                "packshot_types": ["front", "back"]
            },
            input_image_url=product.image_url,
            output_urls=new_packshot_urls,
            status="completed",
            credits_used=credits_needed,
            completed_at=datetime.utcnow()
        )
        db.add(generation)
        db.commit()
        
        print(f"✅ Re-rolled {len(new_packshot_urls)} packshots for {product.name}")
        
        return {
            "message": f"Successfully re-rolled packshots for {product.name}",
            "packshots": new_packshot_urls,
            "credits_remaining": user.credits
        }
        
    except Exception as e:
        print(f"❌ Packshot re-roll failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Model Pose Generation ----------
@app.post("/models/{model_id}/generate-poses")
async def generate_model_poses_endpoint(
    model_id: str,
    prompt: str = Form("fashion model in different full-body poses"),
    variants: int = Form(1),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate poses for a specific model"""
    try:
        # Get model
        model = db.query(Model).filter(
            Model.id == model_id,
            Model.user_id == current_user["user_id"]
        ).first()
        
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Check user credits
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        credits_needed = variants
        if user.credits < credits_needed:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient credits. You have {user.credits} credits, but need {credits_needed}"
            )
        
        # Use the model's image URL directly
        model_url = model.image_url
        print(f"Using model URL: {model_url}")
        
        # Create gender-specific prompt
        model_gender = model.gender or "male"  # Default to male if gender not set
        gender_specific_prompt = f"{model_gender} {prompt}"
        print(f"Model gender: {model_gender}")
        print(f"Gender-specific prompt: {gender_specific_prompt}")
        
        # Generate different poses
        print(f"Calling run_consistent_character with URL: {model_url}")
        pose_urls = run_consistent_character(
            model_image_url=model_url,
            prompt=gender_specific_prompt,
            variants=variants
        )
        print(f"Got pose URLs: {pose_urls}")
        
        # Download and store pose images locally to avoid URL expiration
        local_pose_urls = []
        for i, pose_url in enumerate(pose_urls):
            try:
                local_url = download_and_store_image(pose_url, f"pose_{i+1}")
                local_pose_urls.append(local_url)
            except Exception as e:
                print(f"⚠️ Failed to download pose {i+1}, using original URL: {e}")
                local_pose_urls.append(pose_url)
        
        print(f"Stored local pose URLs: {local_pose_urls}")
        
        # Update the existing model with new poses
        existing_poses = model.poses or []
        model.poses = existing_poses + local_pose_urls
        model.updated_at = datetime.utcnow()
        
        # Deduct credits
        user.credits -= credits_needed
        
        # Commit changes
        db.commit()
        
        print(f"✅ Updated model {model.name} with {len(local_pose_urls)} new poses")
        print(f"Total poses: {len(model.poses)}")
        
        return {
            "success": True,
            "model_id": model.id,
            "model_name": model.name,
            "urls": local_pose_urls,
            "total_poses": len(model.poses),
            "credits_used": credits_needed,
            "remaining_credits": user.credits
        }
        
    except Exception as e:
        print(f"❌ Pose generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Scene Endpoints ----------
@app.get("/scenes", response_model=List[SceneResponse])
async def get_scenes(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all scenes for the current user (including standard scenes)"""
    # Get user's custom scenes
    user_scenes = db.query(Scene).filter(Scene.user_id == current_user["user_id"]).all()
    
    # Get standard scenes (these are shared across all users)
    standard_scenes = db.query(Scene).filter(Scene.is_standard == True).all()
    
    # Combine and return
    all_scenes = standard_scenes + user_scenes
    return all_scenes

@app.post("/scenes/upload", response_model=SceneResponse)
async def upload_scene(
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form(""),
    scene_image: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a custom scene"""
    try:
        # Save uploaded image
        os.makedirs("uploads", exist_ok=True)
        filename = f"scene_{hash(str(name + str(datetime.utcnow())))}.jpg"
        filepath = f"uploads/{filename}"
        
        with open(filepath, "wb") as buffer:
            content = await scene_image.read()
            buffer.write(content)
        
        scene_url = f"http://localhost:8000/static/{filename}"
        
        # Create scene record
        scene = Scene(
            user_id=current_user["user_id"],
            name=name,
            description=description,
            image_url=scene_url,
            is_standard=False,
            category=category,
            tags=[]
        )
        db.add(scene)
        db.commit()
        db.refresh(scene)
        
        print(f"✅ Scene uploaded: {name}")
        return scene
        
    except Exception as e:
        print(f"❌ Scene upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scenes/initialize-standard")
async def initialize_standard_scenes(db: Session = Depends(get_db)):
    """Initialize the 6 standard scenes (admin function)"""
    try:
        # Check if standard scenes already exist
        existing_standard = db.query(Scene).filter(Scene.is_standard == True).first()
        if existing_standard:
            return {"message": "Standard scenes already initialized"}
        
        # Create 6 standard scenes
        standard_scenes = [
            {
                "name": "Studio White",
                "description": "Clean white studio background for professional product shots",
                "category": "studio",
                "image_url": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=600&fit=crop",
                "tags": ["studio", "white", "clean", "professional"]
            },
            {
                "name": "Urban Street",
                "description": "Modern urban street setting for lifestyle photography",
                "category": "outdoor",
                "image_url": "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=600&fit=crop",
                "tags": ["urban", "street", "lifestyle", "modern"]
            },
            {
                "name": "Beach Sunset",
                "description": "Tropical beach with golden hour lighting",
                "category": "outdoor",
                "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
                "tags": ["beach", "sunset", "tropical", "golden hour"]
            },
            {
                "name": "Cozy Home",
                "description": "Warm and inviting home interior setting",
                "category": "lifestyle",
                "image_url": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop",
                "tags": ["home", "cozy", "interior", "lifestyle"]
            },
            {
                "name": "Modern Office",
                "description": "Contemporary office environment for professional settings",
                "category": "professional",
                "image_url": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop",
                "tags": ["office", "modern", "professional", "business"]
            },
            {
                "name": "Nature Forest",
                "description": "Serene forest setting with natural lighting",
                "category": "outdoor",
                "image_url": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop",
                "tags": ["forest", "nature", "natural", "serene"]
            }
        ]
        
        for scene_data in standard_scenes:
            scene = Scene(
                user_id="system",  # System user for standard scenes
                name=scene_data["name"],
                description=scene_data["description"],
                image_url=scene_data["image_url"],
                is_standard=True,
                category=scene_data["category"],
                tags=scene_data["tags"]
            )
            db.add(scene)
        
        db.commit()
        print("✅ Standard scenes initialized")
        return {"message": "Standard scenes initialized successfully"}
        
    except Exception as e:
        print(f"❌ Standard scenes initialization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/scenes/{scene_id}", response_model=SceneResponse)
async def update_scene(
    scene_id: str,
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form(""),
    tags: str = Form(""),  # Comma-separated tags
    scene_image: UploadFile = File(None),  # Optional new image
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing scene"""
    try:
        # Find the scene
        scene = db.query(Scene).filter(
            Scene.id == scene_id,
            Scene.user_id == current_user["user_id"]
        ).first()
        
        if not scene:
            raise HTTPException(status_code=404, detail="Scene not found")
        
        # Update basic fields
        scene.name = name
        scene.description = description
        scene.category = category
        
        # Parse tags from comma-separated string
        tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()] if tags else []
        scene.tags = tag_list
        
        # Update image if provided
        if scene_image:
            # Save new uploaded scene image
            os.makedirs("uploads", exist_ok=True)
            filename = f"scene_{hash(str(name + str(datetime.utcnow())))}.jpg"
            filepath = f"uploads/{filename}"
            
            with open(filepath, "wb") as buffer:
                content = await scene_image.read()
                buffer.write(content)
            
            scene.image_url = f"http://localhost:8000/static/{filename}"
        
        scene.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(scene)
        
        print(f"✅ Scene updated: {scene.name}")
        return scene
        
    except Exception as e:
        print(f"❌ Scene update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/scenes/{scene_id}")
async def delete_scene(
    scene_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a scene and all associated data"""
    try:
        # Find the scene
        scene = db.query(Scene).filter(
            Scene.id == scene_id,
            Scene.user_id == current_user["user_id"]
        ).first()
        
        if not scene:
            raise HTTPException(status_code=404, detail="Scene not found")
        
        # Check if it's a standard scene (prevent deletion)
        if scene.is_standard:
            raise HTTPException(status_code=400, detail="Cannot delete standard scenes")
        
        # Delete associated generations
        db.query(Generation).filter(Generation.scene_id == scene_id).delete()
        
        # Delete the scene
        db.delete(scene)
        db.commit()
        
        print(f"✅ Scene deleted: {scene.name}")
        return {"message": "Scene deleted successfully"}
        
    except Exception as e:
        print(f"❌ Scene deletion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Campaign Internal Functions ----------
async def generate_campaign_images_internal(
    campaign_id: str,
    current_user: dict,
    db: Session
):
    """Internal function to generate campaign images (called from create_campaign)"""
    try:
        # Get campaign
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            raise Exception("Campaign not found")
        
        if campaign.status not in ["processing", "completed"]:
            raise Exception("Campaign is not in processing or completed status")
        
        # Use campaign settings
        product_id_list = campaign.settings.get("product_ids", [])
        model_id_list = campaign.settings.get("model_ids", [])
        scene_id_list = campaign.settings.get("scene_ids", [])
        selected_poses_dict = campaign.settings.get("selected_poses", {})
        
        products = db.query(Product).filter(Product.id.in_(product_id_list)).all()
        models = db.query(Model).filter(Model.id.in_(model_id_list)).all()
        scenes = db.query(Scene).filter(Scene.id.in_(scene_id_list)).all()
        
        if not products or not models or not scenes:
            raise Exception("Missing products, models, or scenes")
        
        # Get existing generated images or start fresh
        existing_images = campaign.settings.get("generated_images", [])
        generated_images = existing_images.copy()  # Start with existing images
        
        # Calculate total combinations based on label-based system
        # Group products by clothing_type for label-based application
        products_by_type = {}
        for product in products:
            if product.clothing_type:
                if product.clothing_type not in products_by_type:
                    products_by_type[product.clothing_type] = product
        
        # If no products have clothing_type, fall back to single product processing
        if not products_by_type:
            total_combinations = len(products) * len(models) * len(scenes)
        else:
            # Label-based: one combination per model-scene pair
            total_combinations = len(models) * len(scenes)
        
        completed = len(existing_images)  # Start with existing count
        
        print(f"🎯 Starting campaign generation for: {campaign.name}")
        if products_by_type:
            print(f"📊 Processing {len(products_by_type)} clothing types × {len(models)} models × {len(scenes)} scenes = {total_combinations} combinations (label-based)")
        else:
            print(f"📊 Processing {len(products)} products × {len(models)} models × {len(scenes)} scenes = {total_combinations} combinations (fallback)")
        print(f"📊 Existing images: {len(existing_images)}, Generating more...")
        
        # Process each combination using label-based clothing system
        try:
            # Log the products by type
            for clothing_type, product in products_by_type.items():
                print(f"🏷️ Added {product.name} as {clothing_type}")
            
            for product in products:
                if not product.clothing_type:
                    print(f"⚠️ Product {product.name} has no clothing_type, skipping label-based system")
            
            # If no products have clothing_type, fall back to single product processing
            if not products_by_type:
                print("⚠️ No products with clothing_type found, falling back to single product processing")
                for product in products:
                    for model in models:
                        for scene in scenes:
                            try:
                                print(f"🔄 Processing (fallback): {product.name} + {model.name} + {scene.name}")
                                
                                # Choose model image - use selected poses if available, otherwise random pose, otherwise original
                                model_image_url = model.image_url
                                selected_model_poses = selected_poses_dict.get(model.id, [])
                                
                                if selected_model_poses and len(selected_model_poses) > 0:
                                    import random
                                    model_image_url = random.choice(selected_model_poses)
                                    print(f"🎭 Using selected pose image: {model_image_url[:50]}...")
                                elif model.poses and len(model.poses) > 0:
                                    import random
                                    model_image_url = random.choice(model.poses)
                                    print(f"🎭 Using random pose image: {model_image_url[:50]}...")
                                else:
                                    print(f"🎭 Using original model image: {model_image_url[:50]}...")
                                
                                # Use high quality mode for better results
                                quality_mode = "high"
                                
                                # Step 1: Apply try-on directly to the pose image (Vella first for better clothing application)
                                print(f"🎭 Calling run_vella_try_on to ensure model wears ONLY {product.name}...")
                                try_on_url = run_vella_try_on(model_image_url, product.image_url, quality_mode)
                                print(f"✅ Vella try-on completed: {try_on_url[:50]}...")
                                
                                # Step 2: Place the try-on result into scene with proper lighting (Qwen second)
                                print(f"🎬 Calling run_qwen_scene_composition...")
                                scene_composite_url = run_qwen_scene_composition(try_on_url, scene.image_url, quality_mode)
                                print(f"✅ Qwen scene composition completed: {scene_composite_url[:50]}...")
                                
                                # Step 3: Apply Nano Banana refinement for professional quality (Final enhancement)
                                final_image_url = run_nano_banana_refinement(scene_composite_url, quality_mode)
                                
                                # Continue with the rest of the fallback logic...
                                # [Rest of the fallback processing logic would go here]
                                continue
                                
                            except Exception as e:
                                print(f"❌ Fallback processing failed for {product.name} + {model.name} + {scene.name}: {e}")
                                continue
            
            # Label-based processing: process each model-scene combination with all selected clothing
            for model in models:
                for scene in scenes:
                    try:
                        # Create a description of the clothing combination
                        clothing_names = [f"{product.name} ({product.clothing_type})" for product in products_by_type.values()]
                        clothing_description = " + ".join(clothing_names)
                        print(f"🔄 Processing (label-based): {clothing_description} + {model.name} + {scene.name}")
                        
                        # Choose model image - use selected poses if available, otherwise random pose, otherwise original
                        model_image_url = model.image_url
                        selected_model_poses = selected_poses_dict.get(model.id, [])
                        
                        if selected_model_poses and len(selected_model_poses) > 0:
                            import random
                            model_image_url = random.choice(selected_model_poses)
                            print(f"🎭 Using selected pose image: {model_image_url[:50]}...")
                        elif model.poses and len(model.poses) > 0:
                            import random
                            model_image_url = random.choice(model.poses)
                            print(f"🎭 Using random pose image: {model_image_url[:50]}...")
                        else:
                            print(f"🎭 Using original model image: {model_image_url[:50]}...")
                        
                        # Use high quality mode for better results
                        quality_mode = "high"
                        
                        # Step 1: Apply try-on with products
                        if products_by_type:
                            # Label-based try-on with multiple clothing items
                            print(f"🎭 Calling run_vella_try_on_with_labels to apply clothing by type...")
                            products_by_type_urls = {clothing_type: product.image_url for clothing_type, product in products_by_type.items()}
                            try_on_url = run_vella_try_on_with_labels(model_image_url, products_by_type_urls, quality_mode)
                            print(f"✅ Label-based Vella try-on completed: {try_on_url[:50]}...")
                        elif len(products) > 0:
                            # No clothing_type labels, but we have products - apply simple try-on with first product
                            print(f"🎭 Applying simple try-on with product: {products[0].name}...")
                            try_on_url = run_vella_try_on(model_image_url, products[0].image_url, quality_mode)
                            print(f"✅ Simple Vella try-on completed: {try_on_url[:50]}...")
                        else:
                            # No products at all - just use model pose
                            print(f"⚠️ No products selected, using model pose directly...")
                            try_on_url = model_image_url
                        
                        # Step 2: Place the try-on result into scene with proper lighting (Qwen second)
                        print(f"🎬 Calling run_qwen_scene_composition...")
                        scene_composite_url = run_qwen_scene_composition(try_on_url, scene.image_url, quality_mode)
                        print(f"✅ Qwen scene composition completed: {scene_composite_url[:50]}...")
                        
                        # Step 3: Apply Nano Banana refinement for professional quality (Final enhancement)
                        final_image_url = run_nano_banana_refinement(scene_composite_url, quality_mode)
                        
                        # Download and store the final image locally
                        final_image_url = download_and_save_image(final_image_url, "campaign")
                        
                        # Save generation record for each product (for tracking purposes)
                        last_generation_id = None
                        if products_by_type:
                            for clothing_type, product in products_by_type.items():
                                generation = Generation(
                                    user_id=current_user["user_id"],
                                    campaign_id=campaign.id,
                                    product_id=product.id,
                                    model_id=model.id,
                                    scene_id=scene.id,
                                    mode="campaign_composite_labeled",
                                    prompt=f"Campaign composite (label-based): {clothing_description} + {model.name} + {scene.name}",
                                    settings={
                                        "clothing_types": list(products_by_type.keys()),
                                        "clothing_description": clothing_description,
                                        "model_name": model.name,
                                        "scene_name": scene.name,
                                        "model_image_url": model_image_url,
                                        "scene_composite_url": scene_composite_url,
                                        "try_on_url": try_on_url,
                                        "label_based": True
                                    },
                                    output_urls=[final_image_url],
                                    video_urls=[],  # Videos will be generated on-demand
                                    status="completed"
                                )
                                db.add(generation)
                                db.flush()  # Ensure ID is generated
                                last_generation_id = generation.id
                        else:
                            # No products, create a single generation record
                            generation = Generation(
                                user_id=current_user["user_id"],
                                campaign_id=campaign.id,
                                product_id=None,
                                model_id=model.id,
                                scene_id=scene.id,
                                mode="campaign_composite_labeled",
                                prompt=f"Campaign composite (label-based):  + {model.name} + {scene.name}",
                                settings={
                                    "clothing_types": [],
                                    "clothing_description": "",
                                    "model_name": model.name,
                                    "scene_name": scene.name,
                                    "model_image_url": model_image_url,
                                    "scene_composite_url": scene_composite_url,
                                    "try_on_url": try_on_url,
                                    "label_based": True
                                },
                                output_urls=[final_image_url],
                                video_urls=[],  # Videos will be generated on-demand
                                status="completed"
                            )
                            db.add(generation)
                            db.flush()  # Ensure ID is generated
                            last_generation_id = generation.id
                        
                        # Add to generated images (only once per combination, not per product)
                        generated_images.append({
                            "generation_id": last_generation_id if last_generation_id else None,  # Use the last generation ID
                            "clothing_description": clothing_description,
                            "model_name": model.name,
                            "scene_name": scene.name,
                            "image_url": final_image_url,
                            "model_image_url": model_image_url,
                            "scene_composite_url": scene_composite_url,
                            "try_on_url": try_on_url
                        })
                        
                        completed += 1
                        print(f"✅ Completed {completed}/{total_combinations}: {clothing_description} + {model.name} + {scene.name}")
                        
                    except Exception as e:
                        print(f"❌ Failed combination {clothing_description} + {model.name} + {scene.name}: {e}")
                        import traceback
                        traceback.print_exc()
                        # Continue with other combinations
                        continue
        except Exception as e:
            print(f"❌ Campaign generation loop failed: {e}")
            import traceback
            traceback.print_exc()
            raise e
        
        # Update campaign status
        campaign.status = "completed" if completed > 0 else "failed"
        
        # Create new settings dict to ensure SQLAlchemy detects the change
        new_settings = dict(campaign.settings)
        new_settings["generated_images"] = generated_images
        new_settings["completed_combinations"] = completed
        new_settings["total_combinations"] = total_combinations
        
        campaign.settings = new_settings
        
        db.commit()
        db.refresh(campaign)
        
        print(f"🔍 Debug: Campaign settings after update: {campaign.settings}")
        
        print(f"🎉 Campaign generation completed: {completed}/{total_combinations} images generated")
        
        return {
            "message": f"Campaign generation completed! Generated {completed}/{total_combinations} images.",
            "campaign": CampaignResponse.model_validate(campaign),
            "generated_images": generated_images,
            "completed": completed,
            "total": total_combinations
        }
        
    except Exception as e:
        print(f"❌ Campaign generation failed: {e}")
        raise e

# ---------- Campaign Endpoints ----------
@app.post("/campaigns/create")
async def create_campaign(
    name: str = Form(...),
    description: str = Form(""),
    product_ids: str = Form(...),  # JSON string of product IDs
    model_ids: str = Form(...),    # JSON string of model IDs
    scene_ids: str = Form(...),    # JSON string of scene IDs
    selected_poses: str = Form("{}"),  # JSON string of selected poses per model
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new campaign with selected products, models, and scenes"""
    try:
        import json
        
        # Parse the JSON strings
        product_id_list = json.loads(product_ids)
        model_id_list = json.loads(model_ids)
        scene_id_list = json.loads(scene_ids)
        selected_poses_dict = json.loads(selected_poses)
        
        # Validate that we have at least one of each
        if not product_id_list or not model_id_list or not scene_id_list:
            raise HTTPException(
                status_code=400,
                detail="Please select at least one product, one model, and one scene"
            )
        
        # Check user credits (estimate: 2 credits per combination)
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        total_combinations = len(product_id_list) * len(model_id_list) * len(scene_id_list)
        credits_needed = total_combinations * 2  # 2 credits per try-on + scene composition
        
        if user.credits < credits_needed:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient credits. You have {user.credits} credits, but need {credits_needed} for this campaign"
            )
        
        # Create campaign
        campaign = Campaign(
            user_id=current_user["user_id"],
            name=name,
            description=description,
            status="processing",
            settings={
                "product_ids": product_id_list,
                "model_ids": model_id_list,
                "scene_ids": scene_id_list,
                "selected_poses": selected_poses_dict,
                "total_combinations": total_combinations,
                "credits_needed": credits_needed
            }
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)
        
        # Deduct credits
        user.credits -= credits_needed
        db.commit()
        
        print(f"🎯 Starting campaign generation: {name}")
        print(f"📊 Combinations: {total_combinations} (Products: {len(product_id_list)}, Models: {len(model_id_list)}, Scenes: {len(scene_id_list)})")
        
        # Start automatic generation process
        try:
            await generate_campaign_images_internal(campaign.id, current_user, db)
            print(f"✅ Campaign generation completed automatically")
        except Exception as e:
            print(f"❌ Campaign generation failed: {e}")
            # Update campaign status to failed
            campaign.status = "failed"
            db.commit()
        
        return {
            "campaign": CampaignResponse.model_validate(campaign),
            "message": f"Campaign '{name}' created and generated successfully! {total_combinations} images created.",
            "credits_remaining": user.credits,
            "total_combinations": total_combinations
        }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format for product_ids, model_ids, or scene_ids")
    except Exception as e:
        print(f"❌ Campaign creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/campaigns", response_model=List[CampaignResponse])
async def get_campaigns(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all campaigns for the current user"""
    campaigns = db.query(Campaign).filter(Campaign.user_id == current_user["user_id"]).all()
    
    # Add generation data to each campaign
    for campaign in campaigns:
        generations = db.query(Generation).filter(
            Generation.campaign_id == campaign.id,
            Generation.mode.in_(["campaign_composite", "campaign_composite_labeled"])
        ).all()
        
        # Create generated_images array with generation IDs
        generated_images = []
        for gen in generations:
            if gen.output_urls and len(gen.output_urls) > 0:
                # Get related data
                product = db.query(Product).filter(Product.id == gen.product_id).first()
                model = db.query(Model).filter(Model.id == gen.model_id).first()
                scene = db.query(Scene).filter(Scene.id == gen.scene_id).first()
                
                generated_images.append({
                    "generation_id": gen.id,
                    "product_name": product.name if product else "Unknown Product",
                    "model_name": model.name if model else "Unknown Model",
                    "scene_name": scene.name if scene else "Unknown Scene",
                    "image_url": gen.output_urls[0],
                    "video_url": gen.video_urls[0] if gen.video_urls and len(gen.video_urls) > 0 else None,
                    "model_image_url": gen.settings.get("model_image_url", ""),
                    "scene_composite_url": gen.settings.get("scene_composite_url", ""),
                    "try_on_url": gen.settings.get("try_on_url", "")
                })
        
        # Update campaign settings with generated images
        if not campaign.settings:
            campaign.settings = {}
        campaign.settings["generated_images"] = generated_images
    
    return campaigns

@app.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific campaign by ID"""
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user["user_id"]
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return campaign

@app.put("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: str,
    campaign_update: CampaignUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a campaign"""
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user["user_id"]
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Update fields if provided
    if campaign_update.name is not None:
        campaign.name = campaign_update.name
    if campaign_update.description is not None:
        campaign.description = campaign_update.description
    if campaign_update.status is not None:
        campaign.status = campaign_update.status
    if campaign_update.settings is not None:
        campaign.settings = campaign_update.settings
    
    campaign.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(campaign)
    
    return campaign

@app.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a campaign"""
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user["user_id"]
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Delete associated generations
    db.query(Generation).filter(Generation.campaign_id == campaign_id).delete()
    
    # Delete the campaign
    db.delete(campaign)
    db.commit()
    
    return {"message": "Campaign deleted successfully"}

@app.post("/campaigns/{campaign_id}/generate")
async def generate_campaign_images(
    campaign_id: str,
    product_ids: str = Form("[]"),  # JSON string of product IDs
    model_ids: str = Form("[]"),    # JSON string of model IDs  
    scene_ids: str = Form("[]"),    # JSON string of scene IDs
    selected_poses: str = Form("{}"),  # JSON string of selected poses per model
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate all campaign images using try-on + scene composition"""
    try:
        # Get campaign
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user["user_id"]
        ).first()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        if campaign.status not in ["processing", "completed"]:
            raise HTTPException(status_code=400, detail="Campaign is not in processing or completed status")
        
        # Parse the provided parameters or use campaign defaults
        try:
            product_id_list = json.loads(product_ids) if product_ids != "[]" else campaign.settings.get("product_ids", [])
            model_id_list = json.loads(model_ids) if model_ids != "[]" else campaign.settings.get("model_ids", [])
            scene_id_list = json.loads(scene_ids) if scene_ids != "[]" else campaign.settings.get("scene_ids", [])
            selected_poses_dict = json.loads(selected_poses) if selected_poses != "{}" else campaign.settings.get("selected_poses", {})
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON format for parameters")
        
        # If no parameters provided, use campaign defaults
        if not product_id_list:
            product_id_list = campaign.settings.get("product_ids", [])
        if not model_id_list:
            model_id_list = campaign.settings.get("model_ids", [])
        if not scene_id_list:
            scene_id_list = campaign.settings.get("scene_ids", [])
        
        products = db.query(Product).filter(Product.id.in_(product_id_list)).all()
        models = db.query(Model).filter(Model.id.in_(model_id_list)).all()
        scenes = db.query(Scene).filter(Scene.id.in_(scene_id_list)).all()
        
        if not products or not models or not scenes:
            raise HTTPException(status_code=400, detail="Missing products, models, or scenes")
        
        # Get existing generated images or start fresh
        existing_images = campaign.settings.get("generated_images", [])
        generated_images = existing_images.copy()  # Start with existing images
        total_combinations = len(products) * len(models) * len(scenes)
        completed = len(existing_images)  # Start with existing count
        
        # Update campaign status to processing
        campaign.status = "processing"
        db.commit()
        
        print(f"🎯 Starting campaign generation for: {campaign.name}")
        print(f"📊 Processing {len(products)} products × {len(models)} models × {len(scenes)} scenes = {len(products) * len(models) * len(scenes)} combinations")
        print(f"📊 Existing images: {len(existing_images)}, Generating more...")
        
        # Process each combination
        try:
            for product in products:
                for model in models:
                    for scene in scenes:
                    try:
                        print(f"🔄 Processing: {product.name} + {model.name} + {scene.name}")
                        
                        # Choose model image - use selected poses if available, otherwise random pose, otherwise original
                        model_image_url = model.image_url
                            selected_model_poses = selected_poses_dict.get(model.id, [])
                        
                        if selected_model_poses and len(selected_model_poses) > 0:
                            import random
                            # Use selected pose directly - no URL validation for local URLs
                            model_image_url = random.choice(selected_model_poses)
                            print(f"🎭 Using selected pose image: {model_image_url[:50]}...")
                        elif model.poses and len(model.poses) > 0:
                            import random
                            # Use random pose directly - no URL validation for local URLs
                            model_image_url = random.choice(model.poses)
                            print(f"🎭 Using random pose image: {model_image_url[:50]}...")
                        else:
                            print(f"🎭 Using original model image: {model_image_url[:50]}...")
                        
                        # Use high quality mode for better results
                        quality_mode = "high"
                        
                        # Step 1: Apply try-on directly to the pose image (Vella first for better clothing application)
                            # This ensures the model ONLY wears the selected product, replacing any existing clothing
                            print(f"🎭 Calling run_vella_try_on to ensure model wears ONLY {product.name}...")
                        try_on_url = run_vella_try_on(model_image_url, product.image_url, quality_mode)
                            print(f"✅ Vella try-on completed: {try_on_url[:50]}...")
                        
                        # Step 2: Place the try-on result into scene with proper lighting (Qwen second)
                            print(f"🎬 Calling run_qwen_scene_composition...")
                        scene_composite_url = run_qwen_scene_composition(try_on_url, scene.image_url, quality_mode)
                            print(f"✅ Qwen scene composition completed: {scene_composite_url[:50]}...")
                        
                        # Step 3: Apply Nano Banana refinement for professional quality (Final enhancement)
                        final_image_url = run_nano_banana_refinement(scene_composite_url, quality_mode)
                        
                        # Save generation record
                        generation = Generation(
                            user_id=current_user["user_id"],
                            campaign_id=campaign.id,
                            product_id=product.id,
                            model_id=model.id,
                            scene_id=scene.id,
                            mode="campaign_composite",
                            prompt=f"Campaign composite: {product.name} + {model.name} + {scene.name}",
                            settings={
                                "product_name": product.name,
                                "model_name": model.name,
                                "scene_name": scene.name,
                                "model_image_url": model_image_url,
                                "scene_composite_url": scene_composite_url,
                                "try_on_url": try_on_url
                            },
                            output_urls=[final_image_url],
                            video_urls=[],  # Videos will be generated on-demand
                            status="completed"
                        )
                        db.add(generation)
                        
                        generated_images.append({
                                "generation_id": generation.id,
                            "product_name": product.name,
                            "model_name": model.name,
                            "scene_name": scene.name,
                            "image_url": final_image_url,
                                "model_image_url": model_image_url,
                            "scene_composite_url": scene_composite_url,
                            "try_on_url": try_on_url
                        })
                        
                        completed += 1
                        print(f"✅ Completed {completed}/{total_combinations}: {product.name} + {model.name} + {scene.name}")
                        
                    except Exception as e:
                        print(f"❌ Failed combination {product.name} + {model.name} + {scene.name}: {e}")
                            import traceback
                            traceback.print_exc()
                        # Continue with other combinations
                        continue
        except Exception as e:
            print(f"❌ Campaign generation loop failed: {e}")
            import traceback
            traceback.print_exc()
            raise e
        
        # Update campaign status
        campaign.status = "completed" if completed > 0 else "failed"
        
        # Create new settings dict to ensure SQLAlchemy detects the change
        new_settings = dict(campaign.settings)
        new_settings["generated_images"] = generated_images
        new_settings["completed_combinations"] = completed
        new_settings["total_combinations"] = total_combinations
        
        campaign.settings = new_settings
        
        db.commit()
        db.refresh(campaign)
        
        print(f"🔍 Debug: Campaign settings after update: {campaign.settings}")
        
        print(f"🎉 Campaign generation completed: {completed}/{total_combinations} images generated")
        
        return {
            "message": f"Campaign generation completed! Generated {completed}/{total_combinations} images.",
            "campaign": CampaignResponse.model_validate(campaign),
            "generated_images": generated_images,
            "completed": completed,
            "total": total_combinations
        }
        
    except Exception as e:
        print(f"❌ Campaign generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
    """Generate video for a specific generation"""
    try:
        # Get the generation
        generation = db.query(Generation).filter(
            Generation.id == generation_id,
            Generation.user_id == current_user["user_id"]
        ).first()
        
        if not generation:
            raise HTTPException(status_code=404, detail="Generation not found")
        
        # Check if video already exists
        if generation.video_urls and len(generation.video_urls) > 0:
            return {
                "message": "Video already exists for this generation",
                "video_url": generation.video_urls[0]
            }
        
        # Check user credits based on video quality
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Determine credits needed based on video quality and model
        if model == "seedance":
            if video_quality == "1080p":
                credits_needed = 3  # 1080p Seedance costs more
            elif video_quality == "720p":
                credits_needed = 2  # 720p Seedance
            else:  # 480p
                credits_needed = 1  # 480p Seedance
        else:  # wan model
            if video_quality == "720p":
                credits_needed = 2  # 720p Wan costs more (unprofitable at 1 credit)
            else:  # 480p or default
                credits_needed = 1  # 480p Wan is profitable at 1 credit
        
        if user.credits < credits_needed:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient credits. You have {user.credits} credits, but need {credits_needed} for {video_quality} video generation"
            )
        
        # Get the image URL from the generation
        if not generation.output_urls or len(generation.output_urls) == 0:
            raise HTTPException(status_code=400, detail="No image found for this generation")
        
        image_url = generation.output_urls[0]
        
        # Generate video
        print(f"🎬 Generating {video_quality} video using {model} model for generation {generation_id} from image: {image_url[:50]}...")
        if custom_prompt:
            print(f"🎨 Using custom prompt: {custom_prompt[:100]}...")
        
        if model == "seedance":
            video_url = run_seedance_video_generation(image_url, video_quality, duration, custom_prompt)
        else:  # wan model (default)
            video_url = run_wan_video_generation(image_url, video_quality, custom_prompt)
        
        if video_url:
            # Update generation with video URL
            generation.video_urls = [video_url]
            generation.updated_at = datetime.utcnow()
            
            # Deduct credits based on video quality
            user.credits -= credits_needed
            
            db.commit()
            db.refresh(generation)
            db.refresh(user)
            
            print(f"✅ Video generated successfully: {video_url}")
            return {
                "message": "Video generated successfully",
                "video_url": video_url,
                "credits_remaining": user.credits
            }
        else:
            raise HTTPException(
                status_code=500, 
                detail="Video generation failed. The image URL may be expired or inaccessible. Please try generating a new image first."
            )
            
    except Exception as e:
        print(f"❌ Video generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Video generation failed: {str(e)}")

# ---------- API Endpoints ----------
@app.get("/")
async def root():
    return {"message": "Aura Engine API"}

@app.get("/health")
async def health():
    return {"status": "healthy", "message": "Aura Engine API is running"}

@app.get("/test-debug")
async def test_debug():
    print("=== TEST DEBUG ENDPOINT CALLED ===")
    return {"message": "Debug endpoint working", "timestamp": "now"}

@app.post("/jobs/generate")
async def generate_job(
    mode: str = Form(...),
    user_mods: str = Form(""),
    angle: str = Form("front"),
    background: str = Form("white"),
    reflection: bool = Form(False),
    shadow_strength: float = Form(0.35),
    variants: int = Form(4),
    product: UploadFile = File(...),
    scene_or_model: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Check user credits
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        credits_needed = variants
        if user.credits < credits_needed:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient credits. You have {user.credits} credits, but need {credits_needed}"
            )
        
        # Create generation record
        generation = Generation(
            user_id=user.id,
            mode=mode,
            prompt=f"{mode} generation with modifications: {user_mods}",
            settings={
                "angle": angle,
                "background": background,
                "reflection": reflection,
                "shadow_strength": shadow_strength,
                "variants": variants,
                "user_mods": user_mods
            },
            status="processing",
            credits_used=credits_needed
        )
        db.add(generation)
        db.commit()
        db.refresh(generation)
        
        # Save uploaded files temporarily
        os.makedirs("temp", exist_ok=True)
        
        # Save product image
        product_path = f"temp/{product.filename}"
        with open(product_path, "wb") as buffer:
            content = await product.read()
            buffer.write(content)
        
        # Save scene image if provided
        scene_path = None
        if scene_or_model:
            scene_path = f"temp/{scene_or_model.filename}"
            with open(scene_path, "wb") as buffer:
                content = await scene_or_model.read()
                buffer.write(content)
        
        # Convert to URLs (in production, upload to S3)
        # Copy files to uploads directory for serving
        import shutil
        uploads_product_path = f"uploads/{product.filename}"
        shutil.copy2(product_path, uploads_product_path)
        
        product_url = f"http://localhost:8000/static/{product.filename}"
        scene_url = None
        if scene_path:
            uploads_scene_path = f"uploads/{scene_or_model.filename}"
            shutil.copy2(scene_path, uploads_scene_path)
            scene_url = f"http://localhost:8000/static/{scene_or_model.filename}"
        
        # Generate mockups
        urls = run_from_photo_or_png(
            mode=mode,
            product_image_url=product_url,
            user_mods=user_mods,
            angle=angle,
            background=background,
            reflection=reflection,
            shadow_strength=shadow_strength,
            variants=variants,
            scene_or_model_url=scene_url
        )
        
        # Update generation record with results
        generation.input_image_url = product_url
        generation.output_urls = urls
        generation.status = "completed"
        generation.completed_at = datetime.utcnow()
        
        # Deduct credits from user
        user.credits -= credits_needed
        
        db.commit()
        
        return {
            "urls": urls,
            "generation_id": generation.id,
            "credits_remaining": user.credits
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Serve static files
# Create uploads directory if it doesn't exist
os.makedirs("uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="uploads"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
