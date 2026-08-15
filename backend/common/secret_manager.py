import os
import logging

logger = logging.getLogger("secret_manager")

def get_secret(secret_id: str, default: str = "") -> str:
    """Retrieves secret value from environment variables or GCP Secret Manager."""
    # 1. Direct environment variable lookup
    env_val = os.getenv(secret_id, "").strip()
    if env_val:
        return env_val

    # 2. GCP Secret Manager lookup
    project_id = os.getenv("GCP_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT") or "lithe-saga-103615"
    if project_id:
        try:
            from google.cloud import secretmanager
            client = secretmanager.SecretManagerServiceClient()
            name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
            response = client.access_secret_version(request={"name": name})
            secret_value = response.payload.data.decode("UTF-8").strip()
            if secret_value:
                logger.info(f"Retrieved secret '{secret_id}' from GCP Secret Manager.")
                return secret_value
        except Exception as e:
            logger.debug(f"Could not access Secret Manager for '{secret_id}': {e}")

    return default
