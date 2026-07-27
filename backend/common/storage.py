import os
import logging
import base64
import urllib.parse
from abc import ABC, abstractmethod

logger = logging.getLogger("storage")

class CloudStorage(ABC):
    @abstractmethod
    def upload_image(self, base64_image: str, file_name: str, user_id: str = "default", timestamp_str: str = "temp", store_name: str = "pending") -> str:
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

    @abstractmethod
    def rename_image(self, old_url: str, new_user_id: str, new_timestamp: str, new_store_name: str, file_name: str) -> str:
        """
        Renames/moves a file in GCS storage and returns the new public URL or URI.
        """
        pass

class Base64Storage(CloudStorage):
    """Fallback storage that returns raw base64 data URIs without uploading to the cloud"""
    def upload_image(self, base64_image: str, file_name: str, user_id: str = "default", timestamp_str: str = "temp", store_name: str = "pending") -> str:
        if base64_image.startswith("data:image/"):
            return base64_image
        return f"data:image/jpeg;base64,{base64_image}"

    def download_image(self, image_source: str) -> bytes:
        clean_base64 = image_source
        if "," in image_source:
            clean_base64 = image_source.split(",")[1]
        return base64.b64decode(clean_base64)

    def rename_image(self, old_url: str, new_user_id: str, new_timestamp: str, new_store_name: str, file_name: str) -> str:
        return old_url

class GCSStorage(CloudStorage):
    """Google Cloud Storage (GCS) Provider (supports local GCS emulators via STORAGE_EMULATOR_HOST)"""
    def upload_image(self, base64_image: str, file_name: str, user_id: str = "default", timestamp_str: str = "temp", store_name: str = "pending") -> str:
        bucket_name = os.getenv("GCP_GCS_BUCKET")
        if not bucket_name:
            logger.warning("GCP_GCS_BUCKET not configured. Falling back to local base64 storage.")
            return Base64Storage().upload_image(base64_image, file_name, user_id, timestamp_str, store_name)

        try:
            from google.cloud import storage
            
            clean_base64 = base64_image
            if "," in base64_image:
                clean_base64 = base64_image.split(",")[1]
            image_data = base64.b64decode(clean_base64)

            # Resolves GCP credentials from environmental defaults (or connects to emulator if STORAGE_EMULATOR_HOST is set)
            client = storage.Client()
            bucket = client.bucket(bucket_name)
            
            # Format: user_id/dd-mm-yyyy-timestamp/store-name/file_name.jpg
            blob_name = f"{user_id}/{timestamp_str}/{store_name}/{file_name}.jpg"
            blob = bucket.blob(blob_name)

            blob.upload_from_string(image_data, content_type="image/jpeg")
            
            # Formulate URL
            gcs_url = f"https://storage.googleapis.com/{bucket_name}/{blob_name}"
                
            logger.info(f"Uploaded to GCS: {gcs_url}")
            return gcs_url
        except Exception as e:
            logger.error(f"GCS upload failed: {str(e)}. Falling back to base64.")
            return Base64Storage().upload_image(base64_image, file_name, user_id, timestamp_str, store_name)

    def download_image(self, image_source: str) -> bytes:
        if image_source.startswith("data:image/") or not image_source.startswith("http"):
            return Base64Storage().download_image(image_source)

        try:
            from google.cloud import storage
            parsed = urllib.parse.urlparse(image_source)
            
            # Support GS protocol and HTTPS URLs
            if parsed.scheme == "gs":
                bucket_name = parsed.netloc
                blob_name = parsed.path.lstrip("/")
            else:
                parts = parsed.path.lstrip("/").split("/")
                bucket_name = parts[0]
                blob_name = "/".join(parts[1:])

            client = storage.Client()
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(blob_name)
            try:
                return blob.download_as_bytes()
            except Exception as download_err:
                # If download fails and it is a pending path, search for a renamed file under the same prefix
                if "/pending/" in blob_name:
                    logger.info(f"Pending blob not found. Searching for renamed version of {blob_name}...")
                    parts = blob_name.split("/")
                    # Format: user_id/timestamp_str/pending/invoice_id.jpg
                    if len(parts) >= 4:
                        user_id = parts[0]
                        timestamp_str = parts[1]
                        invoice_id = parts[-1].replace(".jpg", "")
                        
                        prefix = f"{user_id}/{timestamp_str}/"
                        blobs = client.list_blobs(bucket, prefix=prefix)
                        for b in blobs:
                            if b.name.endswith(f"/{invoice_id}.jpg"):
                                logger.info(f"Found renamed blob: {b.name}. Downloading...")
                                return b.download_as_bytes()
                raise download_err
        except Exception as e:
            logger.error(f"GCS download failed: {str(e)}")
            raise e

    def rename_image(self, old_url: str, new_user_id: str, new_timestamp: str, new_store_name: str, file_name: str) -> str:
        bucket_name = os.getenv("GCP_GCS_BUCKET")
        if not bucket_name or old_url.startswith("data:image/"):
            return old_url

        try:
            from google.cloud import storage
            parsed = urllib.parse.urlparse(old_url)
            
            if parsed.scheme == "gs":
                old_blob_name = parsed.path.lstrip("/")
            else:
                parts = parsed.path.lstrip("/").split("/")
                # If emulator URL contains bucket name as first part:
                if parts[0] == bucket_name:
                    old_blob_name = "/".join(parts[1:])
                else:
                    old_blob_name = "/".join(parts)

            client = storage.Client()
            bucket = client.bucket(bucket_name)
            old_blob = bucket.blob(old_blob_name)

            new_blob_name = f"{new_user_id}/{new_timestamp}/{new_store_name}/{file_name}.jpg"
            
            try:
                # GCS rename is copy + delete
                new_blob = bucket.copy_blob(old_blob, bucket, new_blob_name)
                old_blob.delete()
            except Exception as rename_err:
                # Check if the renamed target already exists
                check_blob = bucket.blob(new_blob_name)
                if check_blob.exists():
                    logger.info(f"Renamed target already exists: {new_blob_name}. Continuing.")
                else:
                    raise rename_err

            new_url = f"https://storage.googleapis.com/{bucket_name}/{new_blob_name}"
                
            logger.info(f"Renamed GCS blob from {old_blob_name} to {new_blob_name}")
            return new_url
        except Exception as e:
            logger.error(f"Failed to rename GCS blob: {str(e)}")
            return old_url

def get_storage_provider() -> CloudStorage:
    """Factory function returning the configured storage driver"""
    provider_name = os.getenv("STORAGE_PROVIDER", "GCS").upper()
    if provider_name == "BASE64":
        return Base64Storage()
    else:
        return GCSStorage()
