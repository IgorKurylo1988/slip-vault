locals {
  dns_name = "slip-vault.com"
}
data "cloudflare_zone" "zone" {
  filter = {
    name = local.dns_name
  }
}

data "terraform_remote_state" "gcp_web" {
  backend = "gcs"
  config = {
    bucket = "slip-vault-tf-cm-data"
    prefix = "web"
  }
}

# Root domain DNS record pointing to GCP Load Balancer IP
resource "cloudflare_dns_record" "web_root" {
  zone_id = data.cloudflare_zone.zone.id
  name    = "@"
  content = data.terraform_remote_state.gcp_web.outputs.load_balancer_ip
  type    = "A"
  proxied = true
  ttl     = 1
}

# Redirect www to root domain
resource "cloudflare_page_rule" "redirect_www_to_root" {
  zone_id = data.cloudflare_zone.zone.id
  target  = "www.slip-vault.com/*"
  status  = "active"
  actions = {
    forwarding_url = {
      url         = "https://slip-vault.com/$1"
      status_code = 301
    }
  }
}

# Phase 2: Placeholder for API Service DNS Record (to be customized and uncommented later)
# resource "cloudflare_dns_record" "api_service" {
#   zone_id = var.cloudflare_zone_id
#   name    = "api"
#   content   = "<your-gcp-api-load-balancer-ip-or-dns>"
#   type    = "CNAME" # change to "A" if using direct external static IP
#   proxied = true
#   ttl     = 1
# }
