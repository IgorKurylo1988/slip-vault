output "bucket_name" {
  value       = google_storage_bucket.static_website.name
  description = "The name of the GCS bucket"
}

output "website_url" {
  value       = "http://${google_storage_bucket.static_website.name}.storage.googleapis.com"
  description = "GCS Native public endpoint URL"
}
