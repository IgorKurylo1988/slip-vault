import {
  to = module.api_service.google_cloud_run_v2_service.service
  id = "projects/lithe-saga-103615/locations/europe-central2/services/slip-vault-api"
}

import {
  to = module.api_service.google_cloud_run_v2_service_iam_member.public_access[0]
  id = "projects/lithe-saga-103615/locations/europe-central2/services/slip-vault-api roles/run.invoker allUsers"
}

import {
  to = module.api_service.google_cloud_run_domain_mapping.domain_mapping[0]
  id = "locations/europe-central2/namespaces/lithe-saga-103615/domainmappings/api.slip-vault.com"
}

module "api_service" {
  source                = "../../modules/cloud_run_service"
  service_name          = "slip-vault-api"
  location              = var.region
  project_id            = var.project_id
  image_tag             = var.image_tag
  service_account_email = "slip-vault-api-sa@${var.project_id}.iam.gserviceaccount.com"
  container_port        = 8000
  ingress               = "INGRESS_TRAFFIC_ALL"
  allow_unauthenticated = true
  custom_domain         = "api.slip-vault.com"
  env_vars = {
    STORAGE_PROVIDER    = "GCS"
    DATABASE_PROVIDER   = "FIRESTORE"
    GCP_GCS_BUCKET      = var.gcs_bucket_name
    MESSAGING_PROVIDER  = "GCP_PUBSUB"
    GCP_PROJECT_ID      = var.project_id
    GCP_PUBSUB_TOPIC_ID = var.pubsub_topic_name
  }
}

output "api_service_url" {
  description = "The public endpoint URL of the API Service"
  value       = module.api_service.uri
}
