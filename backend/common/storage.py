import os
import logging
import base64
import urllib.parse
from abc import ABC, abstractmethod

logger = logging.getLogger("storage")

class CloudStorage(ABC):
    @abstractmethod
    def upload_image(self, base64_image: str, file_name: str) -> str:
        """
        Uploads a base64 image file and returns its public URL or URI.
        """
        pass

    @abstractmethod
    def download_image(self, image_source: str) -> bytes:
        """
        Downloads and returns raw bytes from the given URL or base64 string.
        """
        pass

class Base64Storage(CloudStorage):
    """Fallback storage that returns raw base64 data URIs without uploading to the cloud"""
    def upload_image(self, base64_image: str, file_name: str) -> str:
        if base64_image.startswith("data:image/"):
            return base64_image
        return f"data:image/jpeg;base64,{base64_image}"

    def download_image(self, image_source: str) -> bytes:
        clean_base64 = image_source
        if "," in image_source:
            clean_base64 = image_source.split(",")[1]
        return base64.b64decode(clean_base64)

class GCSStorage(CloudStorage):
    """Google Cloud Storage (GCS) Provider (supports local GCS emulators via STORAGE_EMULATOR_HOST)"""
    def upload_image(self, base64_image: str, file_name: str) -> str:
        bucket_name = os.getenv("GCP_GCS_BUCKET")
        if not bucket_name:
            logger.warning("GCP_GCS_BUCKET not configured. Falling back to local base64 storage.")
            return Base64Storage().upload_image(base64_image, file_name)

        try:
            from google.cloud import storage
            
            clean_base64 = base64_image
            if "," in base64_image:
                clean_base64 = base64_image.split(",")[1]
            image_data = base64.b64decode(clean_base64)

            # Resolves GCP credentials from environmental defaults (or connects to emulator if STORAGE_EMULATOR_HOST is set)
            client = storage.Client()
            bucket = client.bucket(bucket_name)
            blob_name = f"invoices/{file_name}.jpg"
            blob = bucket.blob(blob_name)

            blob.upload_from_string(image_data, content_type="image/jpeg")
            
            # Formulate URL
            emulator_host = os.getenv("STORAGE_EMULATOR_HOST")
            if emulator_host:
                gcs_url = f"{emulator_host}/{bucket_name}/{blob_name}"
            else:
                gcs_url = f"https://storage.googleapis.com/{bucket_name}/{blob_name}"
                
            logger.info(f"Uploaded to GCS: {gcs_url}")
            return gcs_url
        except Exception as e:
            logger.error(f"GCS upload failed: {str(e)}. Falling back to base64.")
            return Base64Storage().upload_image(base64_image, file_name)

    def download_image(self, image_source: str) -> bytes:
        if image_source.startswith("data:image/") or not image_source.startswith("http"):
            return Base64Storage().download_image(image_source)

        try:
            from google.cloud import storage
            parsed = urllib.parse.urlparse(image_source)
            
            # Support both gs:// protocol and http/https URL parsing
            if parsed.scheme == "gs":
                bucket_name = parsed.netloc
                blob_name = parsed.path.lstrip("/")
            else:
                # Local emulator or public GCS endpoint URL format
                # e.g., http://gcs-emulator:4443/bucket_name/invoices/id.jpg
                # e.g., https://storage.googleapis.com/bucket_name/invoices/id.jpg
                parts = parsed.path.lstrip("/").split("/")
                # If emulator host has bucket prefix, handle accordingly
                # Usually: /bucket_name/invoices/id.jpg
                bucket_name = parts[0]
                blob_name = "/".join(parts[1:])

            client = storage.Client()
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(blob_name)
            return blob.download_as_bytes()
        except Exception as e:
            logger.error(f"GCS download failed: {str(e)}")
            raise e

def get_storage_provider() -> CloudStorage:
    """Factory function returning the configured storage driver"""
    provider_name = os.getenv("STORAGE_PROVIDER", "GCS").upper()
    if provider_name == "BASE64":
        return Base64Storage()
    else:
        return GCSStorage()
