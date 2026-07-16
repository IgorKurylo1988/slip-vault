locals {
  dns_name     = "slip-vault.com"
  project_name = "slip-vault"
}

# DNS CNAME for root domain pointing to Pages project
resource "cloudflare_dns_record" "web_root" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  content = "${local.project_name}.pages.dev"
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

# DNS CNAME for www subdomain pointing to Pages project
resource "cloudflare_dns_record" "web_static" {
  zone_id = var.cloudflare_zone_id
  name    = var.static_subdomain
  content = "${local.project_name}.pages.dev"
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

# Redirect www to root domain using modern Redirect Rules (supports account-owned tokens)
resource "cloudflare_ruleset" "redirect_www_to_root" {
  zone_id     = var.cloudflare_zone_id
  name        = "Redirect WWW to Root"
  description = "Redirects www.slip-vault.com to slip-vault.com"
  kind        = "zone"
  phase       = "http_request_dynamic_redirect"

  rules = [
    {
      ref    = "redirect_www_to_root"
      action = "redirect"
      action_parameters = {
        from_value = {
          status_code = 301
          target_url = {
            expression = "concat(\"https://slip-vault.com\", http.request.uri.path)"
          }
          preserve_query_string = true
        }
      }
      expression  = "http.host eq \"www.slip-vault.com\""
      description = "Redirect www to root"
      enabled     = true
    }
  ]
}

# Data source to fetch the remote state from GCP application deployments
data "terraform_remote_state" "gcp_application" {
  backend = "gcs"
  config = {
    bucket = "slip-vault-tf-cm-data"
    prefix = "gcp/application"
  }
}

# DNS CNAME for API Service pointing to Cloud Run URL
resource "cloudflare_dns_record" "api_service" {
  zone_id = var.cloudflare_zone_id
  name    = "api"
  content = replace(replace(data.terraform_remote_state.gcp_application.outputs.api_service_url, "https://", ""), "/", "")
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

# DNS CNAME for Notification Service pointing to Cloud Run URL (supports WebSocket)
resource "cloudflare_dns_record" "notification_service" {
  zone_id = var.cloudflare_zone_id
  name    = "notifications"
  content = replace(replace(data.terraform_remote_state.gcp_application.outputs.notification_service_url, "https://", ""), "/", "")
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

