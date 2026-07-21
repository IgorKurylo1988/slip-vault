import {
  to = module.processor_agent.google_cloud_run_v2_service.service
  id = "projects/lithe-saga-103615/locations/europe-central2/services/slip-vault-processor-agent"
}

import {
  to = google_service_account.pubsub_invoker_sa
  id = "projects/lithe-saga-103615/serviceAccounts/slip-vault-pubsub-invoker-sa@lithe-saga-103615.iam.gserviceaccount.com"
}

import {
  to = google_cloud_run_v2_service_iam_member.pubsub_run_invoker
  id = "projects/lithe-saga-103615/locations/europe-central2/services/slip-vault-processor-agent roles/run.invoker serviceAccount:slip-vault-pubsub-invoker-sa@lithe-saga-103615.iam.gserviceaccount.com"
}

import {
  to = google_pubsub_subscription.push_subscription
  id = "projects/lithe-saga-103615/subscriptions/slip-vault-tasks-push-sub"
}

module "processor_agent" {
  source                = "../../modules/cloud_run_service"
  service_name          = "slip-vault-processor-agent"
  location              = var.region
  project_id            = var.project_id
  image_tag             = var.image_tag
  service_account_email = "slip-vault-processor-sa@${var.project_id}.iam.gserviceaccount.com"
  container_port        = 8080
  ingress               = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  allow_unauthenticated = false
  env_vars = {
    STORAGE_PROVIDER          = "GCS"
    DATABASE_PROVIDER         = "FIRESTORE"
    GCP_PROJECT_ID            = var.project_id
    GCP_GCS_BUCKET            = var.gcs_bucket_name
    MESSAGING_PROVIDER        = "GCP_PUBSUB"
    GCP_PUBSUB_TOPIC_ID       = var.pubsub_topic_name
    LLM_MODEL                 = var.llm_model
    NOTIFICATION_CALLBACK_URL = var.notification_service_url
  }
}

resource "google_service_account" "pubsub_invoker_sa" {
  account_id   = "slip-vault-pubsub-invoker-sa"
  display_name = "Pub/Sub Invoker Service Account for Push Subscription"
}

resource "google_cloud_run_v2_service_iam_member" "pubsub_run_invoker" {
  name     = module.processor_agent.service_name
  location = module.processor_agent.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_invoker_sa.email}"
}

resource "google_pubsub_subscription" "push_subscription" {
  name  = "slip-vault-tasks-push-sub"
  topic = var.pubsub_topic_name

  push_config {
    push_endpoint = "${module.processor_agent.uri}/api/process-task"

    oidc_token {
      service_account_email = google_service_account.pubsub_invoker_sa.email
    }
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.pubsub_run_invoker
  ]
}

output "processor_agent_service_url" {
  description = "The public endpoint URL of the Processor Agent Service"
  value       = module.processor_agent.uri
}
