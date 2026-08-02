# =====================================================================
# IAM Service Accounts & Role Bindings
# =====================================================================

# 1. API Service Account
resource "google_service_account" "api_sa" {
  account_id   = "slip-vault-api-sa"
  display_name = "Service Account for Slip Vault Uploader/API"
  depends_on   = [google_project_service.services]
}

# 2. Processor Agent Service Account
resource "google_service_account" "processor_sa" {
  account_id   = "slip-vault-processor-sa"
  display_name = "Service Account for Slip Vault Receipt Recognition Agent"
  depends_on   = [google_project_service.services]
}

# 3. Notification Service Account
resource "google_service_account" "notification_sa" {
  account_id   = "slip-vault-notification-sa"
  display_name = "Service Account for Slip Vault Notification Service"
  depends_on   = [google_project_service.services]
}

# =====================================================================
# Storage Bucket IAM Permissions
# =====================================================================
resource "google_storage_bucket_iam_member" "api_storage_member" {
  bucket = google_storage_bucket.receipts_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api_sa.email}"
}

resource "google_storage_bucket_iam_member" "processor_storage_member" {
  bucket = google_storage_bucket.receipts_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.processor_sa.email}"
}

# =====================================================================
# Pub/Sub Topic IAM Permissions
# =====================================================================
resource "google_pubsub_topic_iam_member" "api_publisher" {
  topic  = google_pubsub_topic.tasks_topic.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${google_service_account.api_sa.email}"
}

# =====================================================================
# Project-level IAM Permissions (Firestore & Gemini AI Access)
# =====================================================================

# Firestore Database Access
resource "google_project_iam_member" "api_firestore_member" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

resource "google_project_iam_member" "processor_firestore_member" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.processor_sa.email}"
}

resource "google_project_iam_member" "notification_firestore_member" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.notification_sa.email}"
}

# Vertex AI Gemini Access
resource "google_project_iam_member" "processor_vertex_member" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.processor_sa.email}"
}

# Allow API Service Account to sign GCS Blobs locally
resource "google_project_iam_member" "api_token_creator" {
  project = var.project_id
  role    = "roles/iam.serviceAccountTokenCreator"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}
