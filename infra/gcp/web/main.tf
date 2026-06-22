locals {
  domain_name = "slip-vault.com"
}
# The bucket name MUST match the exact custom domain name you use in Cloudflare
resource "google_storage_bucket" "static_website" {
  name          = local.domain_name
  location      = var.bucket_location
  force_destroy = false # Prevents accidental deletion of the bucket and its contents

  website {
    main_page_suffix = "index.html"
    not_found_page   = "404.html" # Redirects missing paths to the custom 404 page (located at the root of dist after build)
  }

  # Set public access prevention to inherited to allow allUsers access
  public_access_prevention = "inherited"
}

# Make all objects public-readable
resource "google_storage_bucket_iam_member" "public_viewer" {
  bucket = google_storage_bucket.static_website.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}



