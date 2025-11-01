#!/usr/bin/env python3
"""
Migration script to add subscription columns to users table
Run this once to update existing database schema
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Get database URL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aura_engine.db")

def migrate_subscription_columns():
    """Add subscription columns to users table if they don't exist"""
    
    if DATABASE_URL.startswith("sqlite"):
        # SQLite migration
        import sqlite3
        db_path = DATABASE_URL.replace("sqlite:///", "")
        
        if not os.path.exists(db_path):
            print(f"❌ Database file not found: {db_path}")
            return False
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        try:
            # Check if columns exist
            cursor.execute("PRAGMA table_info(users)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if "subscription_type" not in columns:
                print("📝 Adding subscription_type column...")
                cursor.execute("ALTER TABLE users ADD COLUMN subscription_type VARCHAR")
                print("✅ Added subscription_type")
            
            if "subscription_credits" not in columns:
                print("📝 Adding subscription_credits column...")
                cursor.execute("ALTER TABLE users ADD COLUMN subscription_credits INTEGER DEFAULT 0")
                print("✅ Added subscription_credits")
            
            if "subscription_status" not in columns:
                print("📝 Adding subscription_status column...")
                cursor.execute("ALTER TABLE users ADD COLUMN subscription_status VARCHAR DEFAULT 'inactive'")
                print("✅ Added subscription_status")
            
            if "subscription_expires_at" not in columns:
                print("📝 Adding subscription_expires_at column...")
                cursor.execute("ALTER TABLE users ADD COLUMN subscription_expires_at TIMESTAMP")
                print("✅ Added subscription_expires_at")
            
            conn.commit()
            print("✅ Migration completed successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
            
    else:
        # PostgreSQL migration
        try:
            import psycopg2
            from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
            
            conn = psycopg2.connect(DATABASE_URL)
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            cursor = conn.cursor()
            
            try:
                # Check if columns exist
                cursor.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'users'
                """)
                columns = [row[0] for row in cursor.fetchall()]
                
                if "subscription_type" not in columns:
                    print("📝 Adding subscription_type column...")
                    cursor.execute("ALTER TABLE users ADD COLUMN subscription_type VARCHAR")
                    print("✅ Added subscription_type")
                
                if "subscription_credits" not in columns:
                    print("📝 Adding subscription_credits column...")
                    cursor.execute("ALTER TABLE users ADD COLUMN subscription_credits INTEGER DEFAULT 0")
                    print("✅ Added subscription_credits")
                
                if "subscription_status" not in columns:
                    print("📝 Adding subscription_status column...")
                    cursor.execute("ALTER TABLE users ADD COLUMN subscription_status VARCHAR DEFAULT 'inactive'")
                    print("✅ Added subscription_status")
                
                if "subscription_expires_at" not in columns:
                    print("📝 Adding subscription_expires_at column...")
                    cursor.execute("ALTER TABLE users ADD COLUMN subscription_expires_at TIMESTAMP")
                    print("✅ Added subscription_expires_at")
                
                print("✅ Migration completed successfully!")
                return True
                
            except Exception as e:
                print(f"❌ Migration failed: {e}")
                import traceback
                traceback.print_exc()
                return False
            finally:
                cursor.close()
                conn.close()
                
        except ImportError:
            print("❌ psycopg2 not installed. Install with: pip install psycopg2-binary")
            return False
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            return False

if __name__ == "__main__":
    print("🔄 Starting subscription columns migration...")
    print(f"📊 Database: {DATABASE_URL}")
    success = migrate_subscription_columns()
    sys.exit(0 if success else 1)

