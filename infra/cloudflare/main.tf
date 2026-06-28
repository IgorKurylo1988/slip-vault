locals {
  dns_name     = "slip-vault.com"
  project_name = "slip-vault"
}

data "cloudflare_zone" "zone" {
  filter = {
    name = local.dns_name
  }
}

# Create the Cloudflare Pages project
resource "cloudflare_pages_project" "web_app" {
  account_id        =var.cloudflare_account_id
  name              = local.project_name
  production_branch = "main"
}

# Bind the custom root domain to the Pages project
resource "cloudflare_pages_domain" "root" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.web_app.name
  name         = local.dns_name
}

# DNS CNAME for root domain pointing to Pages project
resource "cloudflare_dns_record" "web_root" {
  zone_id = data.cloudflare_zone.zone.id
  name    = "@"
  content = "${cloudflare_pages_project.web_app.name}.pages.dev"
  type    = "CNAME"
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
