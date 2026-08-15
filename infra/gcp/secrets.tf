# =====================================================================
# Secret Manager Resources & Permissions
# =====================================================================

resource "google_secret_manager_secret" "resend_api_key" {
  secret_id = "RESEND_API_KEY"
  depends_on = [google_project_service.services]

  replication {
    auto {}
  }
}

# Grant Secret Accessor role to API service account
resource "google_secret_manager_secret_iam_member" "api_resend_secret_access" {
  secret_id = google_secret_manager_secret.resend_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api_sa.email}"
}
