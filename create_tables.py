#!/usr/bin/env python3
"""
Script to create database tables for Aura Engine
This script connects to the Railway PostgreSQL database and creates all required tables.
"""

import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_tables():
    """Create all required database tables"""
    
    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("❌ DATABASE_URL environment variable not found!")
        print("Please set DATABASE_URL to your Railway PostgreSQL connection string")
        return False
    
    print(f"🔗 Connecting to database...")
    print(f"Database URL: {database_url[:20]}...")
    
    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        print("✅ Connected to database successfully!")
        
        # SQL commands to create tables
        tables_sql = [
            """
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                email VARCHAR UNIQUE NOT NULL,
                hashed_password VARCHAR NOT NULL,
                full_name VARCHAR,
                is_active BOOLEAN DEFAULT true,
                is_verified BOOLEAN DEFAULT false,
                credits INTEGER DEFAULT 100,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS campaigns (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR NOT NULL,
                description TEXT,
                status VARCHAR DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS products (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR NOT NULL,
                description TEXT,
                image_url VARCHAR,
                packshots JSONB DEFAULT '[]',
                packshot_front_url VARCHAR,
                packshot_back_url VARCHAR,
                packshot_front_type VARCHAR,
                packshot_back_type VARCHAR,
                category VARCHAR,
                clothing_type VARCHAR,
                tags JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS models (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR NOT NULL,
                description TEXT,
                image_url VARCHAR,
                gender VARCHAR,
                poses JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS scenes (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR NOT NULL,
                description TEXT,
                image_url VARCHAR,
                is_standard BOOLEAN DEFAULT false,
                category VARCHAR,
                tags JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS generations (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                campaign_id VARCHAR REFERENCES campaigns(id),
                product_id VARCHAR REFERENCES products(id),
                model_id VARCHAR REFERENCES models(id),
                scene_id VARCHAR REFERENCES scenes(id),
                mode VARCHAR NOT NULL,
                prompt TEXT NOT NULL,
                settings JSONB DEFAULT '{}',
                input_image_url VARCHAR,
                output_urls JSONB DEFAULT '[]',
                video_urls JSONB DEFAULT '[]',
                status VARCHAR DEFAULT 'pending',
                credits_used INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT NOW(),
                completed_at TIMESTAMP
            );
            """
        ]
        
        # Execute each table creation
        for i, sql in enumerate(tables_sql, 1):
            table_name = sql.split('CREATE TABLE IF NOT EXISTS ')[1].split(' (')[0]
            print(f"📊 Creating table {i}/6: {table_name}...")
            cursor.execute(sql)
            print(f"✅ Table '{table_name}' created successfully!")
        
        # Verify tables were created
        print("\n🔍 Verifying tables...")
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
        print("🚀 Your API should now work properly!")
        return True
        
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Aura Engine Database Setup")
    print("=" * 40)
    
    success = create_tables()
    
    if success:
        print("\n✅ Setup completed successfully!")
        print("You can now test your login functionality.")
    else:
        print("\n❌ Setup failed. Please check the error messages above.")
