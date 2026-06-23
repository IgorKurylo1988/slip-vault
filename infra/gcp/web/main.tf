# The bucket name no longer needs to match the domain name because we use a Load Balancer.
# Removing dots from the name bypasses Google's domain ownership verification requirement.
resource "google_storage_bucket" "static_website" {
  name          = "slip-vault-web-static-${var.project_id}"
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

# Enable the Compute Engine API in the project
resource "google_project_service" "compute" {
  service                    = "compute.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

# Reserve a global external IP address for the load balancer
resource "google_compute_global_address" "web_ip" {
  name       = "slip-vault-web-ip"
  depends_on = [google_project_service.compute]
}

# Create a backend bucket with CDN enabled for the static website
resource "google_compute_backend_bucket" "web_backend" {
  name        = "slip-vault-web-backend"
  bucket_name = google_storage_bucket.static_website.name
  enable_cdn  = true
  depends_on  = [google_project_service.compute]
}

# Create a URL map to route all incoming HTTP requests to the backend bucket
resource "google_compute_url_map" "web_url_map" {
  name            = "slip-vault-web-url-map"
  default_service = google_compute_backend_bucket.web_backend.id
}

# Create a target HTTP proxy to route requests to the URL map
resource "google_compute_target_http_proxy" "web_http_proxy" {
  name    = "slip-vault-web-http-proxy"
  url_map = google_compute_url_map.web_url_map.id
}

# Create a global forwarding rule to route traffic from the global IP to the proxy
resource "google_compute_global_forwarding_rule" "web_forwarding_rule" {
  name        = "slip-vault-web-forwarding-rule"
  ip_address  = google_compute_global_address.web_ip.address
  ip_protocol = "TCP"
  port_range  = "80"
  target      = google_compute_target_http_proxy.web_http_proxy.id
}



