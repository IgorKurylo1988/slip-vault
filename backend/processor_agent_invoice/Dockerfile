FROM python:3.14-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy common modules and the processor_agent_invoice files
COPY common ./common
COPY processor_agent_invoice ./processor_agent_invoice

# Start the worker daemon
CMD ["python", "processor_agent_invoice/agent.py"]
