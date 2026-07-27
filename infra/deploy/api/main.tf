
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
