
data "cloudflare_zone" "zone" {
  name = "slip-vault.com"
}

# Phase 1: Static Website DNS Record (Google Cloud Storage mapping)
resource "cloudflare_record" "web_static" {
  zone_id = data.cloudflare_zone.zone.id
  name    = var.static_subdomain
  value   = var.gcs_cname_target
  type    = "CNAME"
  proxied = true # Enables Cloudflare CDN caching, SSL termination, and DDoS protection
  ttl     = 1    # Auto TTL (required when proxied is true)
}

# Phase 2: Placeholder for API Service DNS Record (to be customized and uncommented later)
# resource "cloudflare_record" "api_service" {
#   zone_id = var.cloudflare_zone_id
#   name    = "api"
#   value   = "<your-gcp-api-load-balancer-ip-or-dns>"
#   type    = "CNAME" # change to "A" if using direct external static IP
#   proxied = true
#   ttl     = 1
# }
