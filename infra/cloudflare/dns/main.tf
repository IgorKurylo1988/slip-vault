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

# Redirect www to root domain using modern Redirect Rules
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

# Remote states for GCP application microservices
data "terraform_remote_state" "gcp_api" {
  backend = "gcs"
  config = {
    bucket = "slip-vault-tf-cm-data"
    prefix = "gcp/application/api"
  }
}

data "terraform_remote_state" "gcp_notification" {
  backend = "gcs"
  config = {
    bucket = "slip-vault-tf-cm-data"
    prefix = "gcp/application/notification"
  }
}

# DNS CNAME for API Service pointing to Cloud Run URL
resource "cloudflare_dns_record" "api_service" {
  zone_id = var.cloudflare_zone_id
  name    = "api"
  content = replace(replace(data.terraform_remote_state.gcp_api.outputs.api_service_url, "https://", ""), "/", "")
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

# DNS CNAME for Notification Service pointing to Cloud Run URL
resource "cloudflare_dns_record" "notification_service" {
  zone_id = var.cloudflare_zone_id
  name    = "notifications"
  content = replace(replace(data.terraform_remote_state.gcp_notification.outputs.notification_service_url, "https://", ""), "/", "")
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

# Rewrite Host header for Cloud Run services (required for europe-central2)
resource "cloudflare_ruleset" "rewrite_cloudrun_host_header" {
  zone_id     = var.cloudflare_zone_id
  name        = "Rewrite Host Header for Cloud Run"
  description = "Rewrites Host header to target .run.app URL for Cloud Run in europe-central2"
  kind        = "zone"
  phase       = "http_request_late_transform"

  rules = [
    {
      action = "rewrite"
      action_parameters = {
        headers = {
          "host" = {
            operation = "set"
            value     = replace(replace(data.terraform_remote_state.gcp_api.outputs.api_service_url, "https://", ""), "/", "")
          }
        }
      }
      expression  = "http.host eq \"api.slip-vault.com\""
      description = "Rewrite Host header for api.slip-vault.com"
      enabled     = true
    },
    {
      action = "rewrite"
      action_parameters = {
        headers = {
          "host" = {
            operation = "set"
            value     = replace(replace(data.terraform_remote_state.gcp_notification.outputs.notification_service_url, "https://", ""), "/", "")
          }
        }
      }
      expression  = "http.host eq \"notifications.slip-vault.com\""
      description = "Rewrite Host header for notifications.slip-vault.com"
      enabled     = true
    }
  ]
}
