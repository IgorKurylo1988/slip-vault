locals {
  dns_name = "slip-vault.com"
}

data "cloudflare_zone" "zone" {
  filter = {
    name = local.dns_name
  }
}

# DNS CNAME for root domain pointing to GCS endpoint (proxied so Cloudflare Worker triggers)
resource "cloudflare_dns_record" "web_root" {
  zone_id = data.cloudflare_zone.zone.id
  name    = "@"
  content = "c.storage.googleapis.com"
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

