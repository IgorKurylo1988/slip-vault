
# =====================================================================
# 1. Cloud Run Deployments (Microservices)
# =====================================================================

# A. Uploader/API Service
resource "google_cloud_run_v2_service" "api_service" {
  name     = "slip-vault-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = var.api_sa_email
    containers {
      image = var.api_image
      ports {
        container_port = 8000
      }
      env {
        name  = "STORAGE_PROVIDER"
        value = "GCS"
      }
      env {
        name  = "DATABASE_PROVIDER"
        value = "FIRESTORE"
      }
      env {
        name  = "GCP_GCS_BUCKET"
        value = var.gcs_bucket_name
      }
      env {
        name  = "MESSAGING_PROVIDER"
        value = "GCP_PUBSUB"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_PUBSUB_TOPIC_ID"
        value = var.pubsub_topic_name
      }
    }
  }
}

# B. Notification Service
resource "google_cloud_run_v2_service" "notification_service" {
  name     = "slip-vault-notification"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = var.notification_sa_email
    containers {
      image = var.notification_image
      ports {
        container_port = 8001
      }
      env {
        name  = "DATABASE_PROVIDER"
        value = "FIRESTORE"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
    }
  }
}

# C. Processor Agent Invoice Service (Scales to zero, triggered by push)
resource "google_cloud_run_v2_service" "processor_agent" {
  name     = "slip-vault-processor-agent"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY" # Expose only to internal Pub/Sub triggers

  template {
    service_account = var.processor_sa_email
    containers {
      image = var.processor_image
      env {
        name  = "STORAGE_PROVIDER"
        value = "GCS"
      }
      env {
        name  = "DATABASE_PROVIDER"
        value = "FIRESTORE"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_GCS_BUCKET"
        value = var.gcs_bucket_name
      }
      env {
        name  = "MESSAGING_PROVIDER"
        value = "GCP_PUBSUB"
      }
      env {
        name  = "GCP_PUBSUB_TOPIC_ID"
        value = var.pubsub_topic_name
      }
      env {
        name  = "LLM_MODEL"
        value = var.llm_model
      }
      env {
        name  = "NOTIFICATION_CALLBACK_URL"
        value = google_cloud_run_v2_service.notification_service.uri
      }
    }
  }
}

# =====================================================================
# 2. Pub/Sub Push Subscription to Trigger Agent Webhook
# =====================================================================
import {
  to = google_service_account.pubsub_invoker_sa
  id = "projects/lithe-saga-103615/serviceAccounts/slip-vault-pubsub-invoker-sa@lithe-saga-103615.iam.gserviceaccount.com"
}

resource "google_service_account" "pubsub_invoker_sa" {
  account_id   = "slip-vault-pubsub-invoker-sa"
  display_name = "Pub/Sub Invoker Service Account for Push Subscription"
}

# Grant Pub/Sub invoker service account permissions to call the Cloud Run processor service
resource "google_cloud_run_v2_service_iam_member" "pubsub_run_invoker" {
  name     = google_cloud_run_v2_service.processor_agent.name
  location = google_cloud_run_v2_service.processor_agent.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_invoker_sa.email}"
}

# Create Pub/Sub subscription pushing task payloads directly to processor agent
resource "google_pubsub_subscription" "push_subscription" {
  name  = "slip-vault-tasks-push-sub"
  topic = var.pubsub_topic_name

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.processor_agent.uri}/api/process-task" # Webhook task handler

    oidc_token {
      service_account_email = google_service_account.pubsub_invoker_sa.email
    }
  }

  depends_on = [
    google_cloud_run_v2_service.processor_agent,
    google_cloud_run_v2_service_iam_member.pubsub_run_invoker
  ]
}

# =====================================================================
# 3. Outputs
# =====================================================================
output "api_service_url" {
  description = "The public endpoint URL of the API Service"
  value       = google_cloud_run_v2_service.api_service.uri
}

output "notification_service_url" {
  description = "The public endpoint URL of the Notification Service"
  value       = google_cloud_run_v2_service.notification_service.uri
}
