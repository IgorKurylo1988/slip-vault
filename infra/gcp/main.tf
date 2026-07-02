
# =====================================================================
# Enable Required GCP APIs
# =====================================================================
resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "firestore.googleapis.com",
    "storage.googleapis.com",
    "pubsub.googleapis.com",
    "aiplatform.googleapis.com", # Vertex AI API for Gemini
    "iam.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}
