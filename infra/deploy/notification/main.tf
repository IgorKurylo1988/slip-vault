import {
  to = module.notification_service.google_cloud_run_v2_service.service
  id = "projects/lithe-saga-103615/locations/europe-central2/services/slip-vault-notification"
}

import {
  to = module.notification_service.google_cloud_run_v2_service_iam_member.public_access[0]
  id = "projects/lithe-saga-103615/locations/europe-central2/services/slip-vault-notification roles/run.invoker allUsers"
}

module "notification_service" {
  source                = "../../modules/cloud_run_service"
  service_name          = "slip-vault-notification"
  location              = var.region
  project_id            = var.project_id
  image_tag             = var.image_tag
  service_account_email = "slip-vault-notification-sa@${var.project_id}.iam.gserviceaccount.com"
  container_port        = 8001
  ingress               = "INGRESS_TRAFFIC_ALL"
  allow_unauthenticated = true
  env_vars = {
    DATABASE_PROVIDER = "FIRESTORE"
    GCP_PROJECT_ID    = var.project_id
  }
}

output "notification_service_url" {
  description = "The public endpoint URL of the Notification Service"
  value       = module.notification_service.uri
}
