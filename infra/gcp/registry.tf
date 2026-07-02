# =====================================================================
# Artifact Registry Repository for Docker Container Images
# =====================================================================
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "slip-vault-repo"
  description   = "Docker Repository for Slip Vault microservices"
  format        = "DOCKER"

  docker_config {
    immutable_tags = false
  }

  depends_on = [google_project_service.services]
}
