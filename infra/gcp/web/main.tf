
locals{
    domain_name="www.slip-vault.com"
}
# The bucket name MUST match the exact custom domain name you use in Cloudflare
resource "google_storage_bucket" "static_website" {
  name          = local.domain_name
  location      = var.bucket_location
  force_destroy = false # Prevents accidental deletion of the bucket and its contents

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html" # Redirects missing paths to index.html (crucial for React SPA routing)
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

# Upload the web app build output files to GCS
resource "google_storage_bucket_object" "web_dist" {
  for_each = fileset("${path.module}/../../../web/dist", "**")

  name         = each.value
  source       = "${path.module}/../../../web/dist/${each.value}"
  bucket       = google_storage_bucket.static_website.name
  content_type = lookup(
    local.mime_types,
    element(split(".", each.value), length(split(".", each.value)) - 1),
    "application/octet-stream"
  )
}

locals {
  mime_types = {
    html  = "text/html"
    css   = "text/css"
    js    = "application/javascript"
    json  = "application/json"
    png   = "image/png"
    jpg   = "image/jpeg"
    jpeg  = "image/jpeg"
    svg   = "image/svg+xml"
    ico   = "image/x-icon"
    webp  = "image/webp"
    txt   = "text/plain"
    woff  = "font/woff"
    woff2 = "font/woff2"
  }
}


