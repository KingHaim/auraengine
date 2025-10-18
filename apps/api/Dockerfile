FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create directories for uploads first
RUN mkdir -p uploads temp

# Copy application code
COPY apps/api/ .

# Ensure uploads directory has the right permissions
RUN chmod -R 755 uploads

# Verify static files exist
RUN ls -la uploads/

# Expose port
EXPOSE 8000

# Run the application using uvicorn with main_simple.py
CMD ["uvicorn", "main_simple:app", "--host", "0.0.0.0", "--port", "8000"]

