# Slip Vault 💳

Slip Vault is a digital wallet designed to store credit invoices, refund receipts, and return notes so they are not lost in pockets and money is not wasted. It uses LiteLLM on the backend to connect with models like Gemini or AWS Bedrock Claude to automatically analyze scanned receipts/credit slips and extract transaction details.

## Project Structure

- `web/`: React + TypeScript frontend built with Vite.
- `backend/`: FastAPI + Python backend with SQLite storage and LiteLLM integration.

---

## Getting Started

### 1. Backend Setup

The backend runs on Python and uses SQLite for local database storage.

1. Navigate to the root directory (or `backend/`) and create a Python virtual environment:
   ```bash
   python -m venv .venv
   ```

2. Activate the virtual environment:
   - **Windows (PowerShell/CMD):**
     ```powershell
     .venv\Scripts\activate
     ```
   - **macOS/Linux:**
     ```bash
     source .venv/bin/activate
     ```

3. Install the required dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

4. Create a `.env` file in the `backend/` folder and add your configuration keys:
   ```env
   # LLM Model Configuration (LiteLLM)
   # Format: "provider/model_name" (e.g. gemini/gemini-2.5-flash, bedrock/anthropic.claude-3-5-sonnet-20240620-v1:0, openai/gpt-4o)
   LLM_MODEL=gemini/gemini-2.5-flash
   GEMINI_API_KEY=your_actual_gemini_api_key
   # OPENAI_API_KEY=your_actual_openai_key

   # Active Providers Selection
   STORAGE_PROVIDER=GCS
   MESSAGING_PROVIDER=GCP_PUBSUB

   # GCP GCS and Pub/Sub Configuration (Shared by local emulator and cloud)
   GCP_PROJECT_ID=slip-vault-project
   GCP_GCS_BUCKET=slip-vault-bucket
   GCP_PUBSUB_TOPIC_ID=slip-vault-topic
   GCP_PUBSUB_SUBSCRIPTION_ID=slip-vault-sub

   # Local Emulators (Leave active for local development via docker-compose)
   STORAGE_EMULATOR_HOST=http://localhost:4443
   PUBSUB_EMULATOR_HOST=localhost:8085
   ```

5. **Start the entire application stack** using Docker Compose:
   ```bash
   docker-compose up --build
   ```

   This launches five containerized services:
   * **GCS Emulator**: Runs local S3-compatible Google Cloud Storage at `http://localhost:4443`.
   * **Pub/Sub Emulator**: Runs local Google Cloud Pub/Sub service at `localhost:8085`.
   * **API Service**: Runs the FastAPI app at `http://localhost:8000`.
   * **Processor Service**: Runs the Pub/Sub background worker.
   * **Web Service**: Runs the React+Vite web application on `http://localhost:3000`.

   *Note: The API service automatically initializes the GCS bucket (`slip-vault-bucket`), Pub/Sub topic (`slip-vault-topic`), and Pub/Sub subscription (`slip-vault-sub`) inside the emulators on startup.*

---

## Alternative Manual Setup (Without Docker)

If you prefer to run the components directly on your host machine:

### 1. Backend Setup
* API Service: `uvicorn backend.api_service.app:app --reload --port 8000`
* Worker Service: `python backend/processor_service/worker.py`

### 2. Frontend Setup
1. Navigate to the `web/` directory:
   ```bash
   cd web
   ```
2. Install the package dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   The app will run locally (typically at `http://localhost:3000`).

---

## Features

- **Receipt Processing**: Pre-processes receipt images client-side for high contrast, and sends them to the Python backend.
- **LiteLLM Extraction**: The Python backend leverages `litellm` to connect generically with models like Gemini, Bedrock Claude, or OpenAI. It uses Pydantic structured schemas to accurately parse merchant details, date, items, SKUs, tax, and total refund amounts.
- **Credit Validation**: Automatically filters out normal receipts and purchase invoices, validating only credit notes and refund slips.
- **Local DB Storage**: Stores all details in a local SQLite database (`invoices.db` inside the backend directory).
- **Digital Sharing**: Generates high-fidelity shareable receipt images with barcode generation and native sharing tools.
