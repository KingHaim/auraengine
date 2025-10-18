#!/bin/bash
# Start the stable Aura Engine API server

echo "🚀 Starting Aura Engine API Server..."

# Kill any existing uvicorn processes
pkill -f uvicorn
sleep 2

# Activate virtual environment
source venv/bin/activate

# Set environment variables
export REPLICATE_API_TOKEN="your_replicate_token_here"
export STRIPE_SECRET_KEY="your_stripe_secret_key_here"
export STRIPE_PUBLISHABLE_KEY="pk_test_51SIbQ9P94ZYHDynVP4Ys1thiP9nFKuL0i2hRRT8s6Xa9rfCQ6q5AC7mS9d2QcN5aRPAerP6o3IyaDpeKew7e9Hyc00ESugEmqg"
export DATABASE_URL="sqlite:///./aura_engine.db"

# Start the server
echo "✅ Starting server with main_simple.py..."
nohup python -m uvicorn main_simple:app --host 0.0.0.0 --port 8000 --reload > server.log 2>&1 &
echo "✅ Server started in background. Check server.log for logs."
