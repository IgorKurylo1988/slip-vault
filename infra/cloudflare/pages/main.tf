locals {
  dns_name     = "slip-vault.com"
  project_name = "slip-vault"
}

# Create the Cloudflare Pages project
resource "cloudflare_pages_project" "web_app" {
  account_id        = var.cloudflare_account_id
  name              = local.project_name
  production_branch = "main"
}

# Bind the custom root domain to the Pages project
resource "cloudflare_pages_domain" "root" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.web_app.name
  name         = local.dns_name
}

# Bind the custom www subdomain to the Pages project
resource "cloudflare_pages_domain" "www" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.web_app.name
  name         = "www.${local.dns_name}"
}
