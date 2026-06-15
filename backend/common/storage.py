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

class S3Storage(CloudStorage):
    """AWS S3 Storage Provider using boto3 (compatible with LocalStack via AWS_ENDPOINT_URL)"""
    def upload_image(self, base64_image: str, file_name: str) -> str:
        bucket_name = os.getenv("AWS_S3_BUCKET")
        if not bucket_name:
            logger.warning("AWS_S3_BUCKET not configured. Falling back to local base64 storage.")
            return Base64Storage().upload_image(base64_image, file_name)

        try:
            import boto3
            clean_base64 = base64_image
            if "," in base64_image:
                clean_base64 = base64_image.split(",")[1]

            image_data = base64.b64decode(clean_base64)

            # Initialize client implicitly, pointing to LocalStack if endpoint is set
            endpoint_url = os.getenv("AWS_ENDPOINT_URL")
            s3_client = boto3.client("s3", endpoint_url=endpoint_url)
            key = f"invoices/{file_name}.jpg"

            s3_client.put_object(
                Bucket=bucket_name,
                Key=key,
                Body=image_data,
                ContentType="image/jpeg"
            )

            aws_region = os.getenv("AWS_REGION", "us-east-1")
            # If using LocalStack, standard URL format might differ or we should just resolve it
            if endpoint_url:
                s3_url = f"{endpoint_url}/{bucket_name}/{key}"
            else:
                s3_url = f"https://{bucket_name}.s3.{aws_region}.amazonaws.com/{key}"
            
            logger.info(f"Uploaded to S3/LocalStack: {s3_url}")
            return s3_url
        except Exception as e:
            logger.error(f"S3 upload failed: {str(e)}. Falling back to base64.")
            return Base64Storage().upload_image(base64_image, file_name)

    def download_image(self, image_source: str) -> bytes:
        if image_source.startswith("data:image/") or not image_source.startswith("http"):
            return Base64Storage().download_image(image_source)

        try:
            import boto3
            parsed = urllib.parse.urlparse(image_source)
            endpoint_url = os.getenv("AWS_ENDPOINT_URL")
            
            if endpoint_url:
                # LocalStack url format: http://localstack:4566/bucket_name/invoices/id.jpg
                # The path contains /bucket_name/invoices/id.jpg
                parts = parsed.path.lstrip("/").split("/")
                bucket_name = parts[0]
                key = "/".join(parts[1:])
            else:
                bucket_name = parsed.netloc.split(".s3")[0]
                key = parsed.path.lstrip("/")

            s3_client = boto3.client("s3", endpoint_url=endpoint_url)
            response = s3_client.get_object(Bucket=bucket_name, Key=key)
            return response['Body'].read()
        except Exception as e:
            logger.error(f"S3 download failed: {str(e)}")
            raise e

class GCSStorage(CloudStorage):
    """Google Cloud Storage (GCS) Provider"""
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

            client = storage.Client()
            bucket = client.bucket(bucket_name)
            blob_name = f"invoices/{file_name}.jpg"
            blob = bucket.blob(blob_name)

            blob.upload_from_string(image_data, content_type="image/jpeg")
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
            return blob.download_as_bytes()
        except Exception as e:
            logger.error(f"GCS download failed: {str(e)}")
            raise e

def get_storage_provider() -> CloudStorage:
    """Factory function returning the configured storage driver"""
    provider_name = os.getenv("STORAGE_PROVIDER", "S3").upper()
    if provider_name == "GCS":
        return GCSStorage()
    elif provider_name == "BASE64":
        return Base64Storage()
    else:
        return S3Storage()
