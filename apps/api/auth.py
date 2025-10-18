from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from models import User
from database import get_db

# Security configuration
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 43200  # 30 days (43200 minutes = 720 hours = 30 days)

# Password hashing - use only pbkdf2_sha256 to avoid bcrypt issues
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# JWT token security
security = HTTPBearer()

def is_bcrypt_hash(hashed_password: str) -> bool:
    """Check if a hash is a bcrypt hash"""
    return hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$") or hashed_password.startswith("$2y$")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    # If it's a bcrypt hash, we need to handle it specially
    if is_bcrypt_hash(hashed_password):
        try:
            # Import bcrypt directly to handle existing bcrypt hashes
            import bcrypt
            # Truncate password to 72 bytes for bcrypt
            truncated_password = plain_password[:72].encode('utf-8')
            return bcrypt.checkpw(truncated_password, hashed_password.encode('utf-8'))
        except Exception as e:
            print(f"Error verifying bcrypt password: {e}")
            return False
    
    # For pbkdf2_sha256 hashes, use the normal context
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    # No truncation needed for pbkdf2_sha256
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Authenticate a user with email and password"""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

def create_user(db: Session, email: str, password: str, full_name: Optional[str] = None) -> User:
    """Create a new user"""
    hashed_password = get_password_hash(password)
    user = User(
        email=email,
        hashed_password=hashed_password,
        full_name=full_name
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def migrate_user_password(db: Session, user: User, new_password: str) -> bool:
    """Migrate a user's password from bcrypt to pbkdf2_sha256"""
    try:
        new_hash = get_password_hash(new_password)
        user.hashed_password = new_hash
        db.commit()
        return True
    except Exception as e:
        print(f"Error migrating user password: {e}")
        db.rollback()
        return False

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> dict:
    """Get the current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    
    return {
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "credits": user.credits
    }
