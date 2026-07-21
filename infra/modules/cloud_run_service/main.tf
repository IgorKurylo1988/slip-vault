locals {
  image_url = "${var.location}-docker.pkg.dev/${var.project_id}/${var.repository_name}/${var.service_name}:${var.image_tag}"
}

resource "google_cloud_run_v2_service" "service" {
  name     = var.service_name
  location = var.location
  ingress  = var.ingress

  template {
    service_account = var.service_account_email
    containers {
      image = local.image_url
      ports {
        container_port = var.container_port
      }
      dynamic "env" {
        for_each = var.env_vars
        iterator = item
        content {
          name  = item.key
          value = item.value
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "public_access" {
  count    = var.allow_unauthenticated ? 1 : 0
  name     = google_cloud_run_v2_service.service.name
  location = google_cloud_run_v2_service.service.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_domain_mapping" "domain_mapping" {
  count    = var.custom_domain != "" ? 1 : 0
  location = var.location
  name     = var.custom_domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.service.name
  }
}
