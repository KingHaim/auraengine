FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including libwebp for WEBP image support
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Ensure Pillow is upgraded to pick up libwebp support
RUN pip install --no-cache-dir --upgrade pillow

# Create directories for uploads and temp
RUN mkdir -p uploads temp static/poses

# Copy application code (this includes static/poses directory with pose images)
COPY apps/api/ .

# Explicitly copy pose files to ensure they're included (in case .dockerignore blocks them)
COPY apps/api/static/poses/*.jpg static/poses/

# Ensure uploads directory has the right permissions
RUN chmod -R 755 uploads static

# Verify pose files were copied
RUN ls -la static/poses/ && echo "✅ Pose files found:" && ls static/poses/*.jpg

# Expose port
EXPOSE 8000

# Run the application using uvicorn with main_simple.py
CMD ["uvicorn", "main_simple:app", "--host", "0.0.0.0", "--port", "8000"]

