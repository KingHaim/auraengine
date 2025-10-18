#!/usr/bin/env python3
"""
Create all remaining database tables for Aura Engine
This script connects to Railway PostgreSQL and creates all required tables.
"""

import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_all_tables():
    """Create all remaining database tables"""
    
    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("❌ DATABASE_URL environment variable not found!")
        print("Please set DATABASE_URL to your Railway PostgreSQL connection string")
        print("You can find this in Railway dashboard → Database → Credentials")
        return False
    
    print(f"🔗 Connecting to Railway database...")
    print(f"Database URL: {database_url[:30]}...")
    
    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        print("✅ Connected to Railway database successfully!")
        
        # SQL commands to create all remaining tables
        tables_sql = [
            """
            CREATE TABLE IF NOT EXISTS models (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                image_url TEXT,
                gender TEXT,
                poses JSONB DEFAULT '[]',
                created_at TEXT DEFAULT NOW(),
                updated_at TEXT DEFAULT NOW()
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                image_url TEXT,
                packshots JSONB DEFAULT '[]',
                packshot_front_url TEXT,
                packshot_back_url TEXT,
                packshot_front_type TEXT,
                packshot_back_type TEXT,
                category TEXT,
                clothing_type TEXT,
                tags JSONB DEFAULT '[]',
                created_at TEXT DEFAULT NOW(),
                updated_at TEXT DEFAULT NOW()
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS scenes (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                image_url TEXT,
                is_standard BOOLEAN DEFAULT false,
                category TEXT,
                tags JSONB DEFAULT '[]',
                created_at TEXT DEFAULT NOW(),
                updated_at TEXT DEFAULT NOW()
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS campaigns (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT,
                created_at TEXT DEFAULT NOW(),
                updated_at TEXT DEFAULT NOW()
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS generations (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id TEXT NOT NULL,
                campaign_id TEXT,
                product_id TEXT,
                model_id TEXT,
                scene_id TEXT,
                mode TEXT NOT NULL,
                prompt TEXT NOT NULL,
                settings JSONB DEFAULT '{}',
                input_image_url TEXT,
                output_urls JSONB DEFAULT '[]',
                video_urls JSONB DEFAULT '[]',
                status TEXT,
                credits_used INTEGER DEFAULT 1,
                created_at TEXT DEFAULT NOW(),
                completed_at TEXT
            );
            """
        ]
        
        # Execute each table creation
        for i, sql in enumerate(tables_sql, 1):
            table_name = sql.split('CREATE TABLE IF NOT EXISTS ')[1].split(' (')[0]
            print(f"📊 Creating table {i}/5: {table_name}...")
            cursor.execute(sql)
            print(f"✅ Table '{table_name}' created successfully!")
        
        # Verify tables were created
        print("\n🔍 Verifying all tables...")
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        print(f"✅ Found {len(tables)} tables:")
        for table in tables:
            print(f"   - {table[0]}")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 All database tables created successfully!")
        print("🚀 Your Aura Engine app should now be fully functional!")
        return True
        
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Aura Engine - Create All Tables")
    print("=" * 40)
    
    success = create_all_tables()
    
    if success:
        print("\n✅ Setup completed successfully!")
        print("🎯 You can now test the full app flow:")
        print("   1. Add a Model")
        print("   2. Add a Product") 
        print("   3. Add a Scene")
        print("   4. Create a Campaign")
    else:
        print("\n❌ Setup failed. Please check the error messages above.")
        print("💡 Make sure you have the DATABASE_URL environment variable set.")
