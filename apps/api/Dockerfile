FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including libwebp for WEBP image support and FFmpeg for video processing
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libwebp-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Ensure Pillow is upgraded to pick up libwebp support
RUN pip install --no-cache-dir --upgrade pillow

# Create directories for uploads and temp
RUN mkdir -p uploads temp

# Copy application code (this includes static/poses directory with pose images)
COPY apps/api/ .

# Ensure uploads directory has the right permissions
RUN chmod -R 755 uploads

# Verify pose files were copied and list them
RUN echo "📁 Checking for pose files..." && \
    if [ -d "static/poses" ]; then \
        ls -la static/poses/ && echo "✅ Pose files found:" && ls static/poses/*.jpg 2>/dev/null || echo "⚠️ No .jpg files in static/poses"; \
    else \
        echo "❌ static/poses directory not found - checking if static/ exists" && \
        ls -la static/ 2>/dev/null || echo "❌ static/ directory not found at all"; \
    fi

# Expose port
EXPOSE 8000

# Run the application using uvicorn with main_simple.py
CMD ["uvicorn", "main_simple:app", "--host", "0.0.0.0", "--port", "8000"]

