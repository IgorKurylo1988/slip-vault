# =====================================================================
# Cloud Storage Bucket for Digitized Receipts
# =====================================================================
resource "google_storage_bucket" "receipts_bucket" {
  name          = var.gcs_bucket_name
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "POST", "PUT", "DELETE", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.services]
}
