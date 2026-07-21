output "service_name" {
  description = "Name of the Cloud Run service"
  value       = google_cloud_run_v2_service.service.name
}

output "uri" {
  description = "URI of the deployed Cloud Run service"
  value       = google_cloud_run_v2_service.service.uri
}

output "location" {
  description = "Location of the service"
  value       = google_cloud_run_v2_service.service.location
}
