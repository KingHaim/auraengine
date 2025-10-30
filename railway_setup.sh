#!/bin/bash

# Railway Database Setup Script
# This script will create all required database tables

echo "🚀 Database Setup"
echo "=============================="

# Check if railway CLI is available
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   curl -fsSL https://railway.app/install.sh | sh"
    exit 1
fi

echo "📋 Creating database tables..."

# SQL commands to create all tables
cat << 'EOF' | railway connect postgres
-- Create users table
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

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    description TEXT,
    status VARCHAR DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create products table
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

-- Create models table
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

-- Create scenes table
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

-- Create generations table
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

-- Verify tables were created
SELECT 'Tables created successfully!' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
EOF

echo "✅ Database setup completed!"
echo "🚀 Your API should now work properly!"
