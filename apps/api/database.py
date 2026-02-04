from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL - use PostgreSQL in production, SQLite for development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aura_engine.db")

# Create engine
if DATABASE_URL.startswith("sqlite"):
    # SQLite with WAL mode for better concurrency (allows reads during writes)
    engine = create_engine(
        DATABASE_URL, 
        connect_args={
            "check_same_thread": False,
            "timeout": 30  # Wait up to 30 seconds for locks
        }
    )
    
    # Enable WAL mode for concurrent reads/writes
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")  # Enable WAL mode
        cursor.execute("PRAGMA busy_timeout=30000")  # 30 second timeout
        cursor.execute("PRAGMA synchronous=NORMAL")  # Better performance
        cursor.close()
        print("✅ SQLite WAL mode enabled for concurrent access")
else:
    engine = create_engine(DATABASE_URL)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """Create all database tables"""
    from models import Base
    Base.metadata.create_all(bind=engine)





