# Simplest GCS static website bucket setup.
# Requires domain ownership verification in Google Search Console for "slip-vault.com".
resource "google_storage_bucket" "static_website" {
  name          = "slip-vault.com"
  location      = var.bucket_location
  force_destroy = false

  website {
    main_page_suffix = "index.html"
    not_found_page   = "404.html"
  }

  public_access_prevention = "inherited"
}

# Make bucket files publicly readable
resource "google_storage_bucket_iam_member" "public_viewer" {
  bucket = google_storage_bucket.static_website.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
