#!/usr/bin/env python3
"""
Railway Database Setup - Create all tables
This script will create all required tables for Aura Engine
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Railway PostgreSQL connection details
# You'll need to replace these with your actual Railway database credentials
RAILWAY_DB_CONFIG = {
    'host': 'containers-us-west-xxx.railway.app',  # Replace with your Railway host
    'port': 'xxxx',  # Replace with your Railway port
    'database': 'railway',
    'user': 'postgres',
    'password': 'NfKyhDwIKsnbMmnnBWKBqReBSmUMGxPY'  # Replace with your Railway password
}

def create_all_tables():
    """Create all required database tables"""
    
    print("🚀 Aura Engine - Database Setup")
    print("=" * 40)
    
    try:
        # Connect to Railway database
        print("🔗 Connecting to Railway database...")
        conn = psycopg2.connect(**RAILWAY_DB_CONFIG)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        print("✅ Connected to Railway database successfully!")
        
        # SQL commands to create all tables
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
        print("\n💡 Make sure to update the RAILWAY_DB_CONFIG with your actual Railway database credentials.")
        return False

if __name__ == "__main__":
    print("📋 Before running this script:")
    print("1. Go to Railway dashboard → Database → Credentials")
    print("2. Copy your database connection details")
    print("3. Update the RAILWAY_DB_CONFIG in this script")
    print("4. Run: python3 railway_db_setup.py")
    print()
    
    # Uncomment the line below after updating the config
    # create_all_tables()
