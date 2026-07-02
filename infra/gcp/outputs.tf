output "gcs_bucket_name" {
  description = "Name of the persistent receipts GCS bucket"
  value       = google_storage_bucket.receipts_bucket.name
}

output "pubsub_topic_name" {
  description = "Name of the tasks Pub/Sub topic"
  value       = google_pubsub_topic.tasks_topic.name
}

output "api_service_account_email" {
  description = "Email of the API service account"
  value       = google_service_account.api_sa.email
}

output "processor_service_account_email" {
  description = "Email of the processor agent service account"
  value       = google_service_account.processor_sa.email
}

output "notification_service_account_email" {
  description = "Email of the notification service account"
  value       = google_service_account.notification_sa.email
}

output "registry_repository_id" {
  description = "The ID of the Artifact Registry repository"
  value       = google_artifact_registry_repository.repo.repository_id
}
