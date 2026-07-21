module "notification_service" {
  source                = "../../modules/cloud_run_service"
  service_name          = "slip-vault-notification"
  location              = var.region
  project_id            = var.project_id
  image_tag             = var.image_tag
  service_account_email = "slip-vault-notification-sa@${var.project_id}.iam.gserviceaccount.com"
  container_port        = 8001
  ingress               = "INGRESS_TRAFFIC_ALL"
  allow_unauthenticated = false
  custom_domain         = "notifications.slip-vault.com"
  env_vars = {
    DATABASE_PROVIDER = "FIRESTORE"
    GCP_PROJECT_ID    = var.project_id
  }
}

output "notification_service_url" {
  description = "The public endpoint URL of the Notification Service"
  value       = module.notification_service.uri
}
