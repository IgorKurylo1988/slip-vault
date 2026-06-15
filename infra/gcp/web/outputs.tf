output "bucket_name" {
  value       = google_storage_bucket.static_website.name
  description = "The name of the GCS bucket"
}

output "website_url" {
  value       = "http://${google_storage_bucket.static_website.name}"
  description = "GCS Native custom domain endpoint (requires DNS CNAME setup)"
}

output "cname_target" {
  value       = "c.storage.googleapis.com"
  description = "The target value for your Cloudflare DNS CNAME record"
}
