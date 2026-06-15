FROM python:3.14-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy common modules and notification_service files
COPY common ./common
COPY notification_service ./notification_service

# Expose Notification port
EXPOSE 8001

# Start FastAPI application for notifications
CMD ["uvicorn", "notification_service.app:app", "--host", "0.0.0.0", "--port", "8001"]
