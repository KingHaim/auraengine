#!/bin/bash

# Development Startup Script

echo "🚀 Starting Development Environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11+ first."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing root dependencies..."
    npm install
fi

if [ ! -d "apps/web/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd apps/web && npm install && cd ../..
fi

if [ ! -d "apps/api/venv" ]; then
    echo "📦 Setting up Python virtual environment..."
    cd apps/api && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && cd ../..
fi

# Create necessary directories
mkdir -p apps/api/uploads apps/api/temp

echo "✅ Dependencies installed!"
echo ""
echo "🔧 Starting services..."
echo ""

# Start backend in background
echo "🐍 Starting FastAPI backend on http://localhost:8000"
cd apps/api && source venv/bin/activate && python main.py &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "⚛️  Starting Next.js frontend on http://localhost:3000"
cd /Users/haimganancia/Desktop/auraengine/apps/web && npm run dev &
FRONTEND_PID=$!

echo ""
echo "🎉 App is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT

# Wait for processes
wait

