variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  description = "The Cloudflare API Token with DNS Zone Edit permissions."
}

variable "cloudflare_zone_id" {
  type        = string
  description = "The Zone ID of your domain in Cloudflare."
}

variable "root_domain" {
  type        = string
  default     = "@"
  description = "The subdomain name for the static website (e.g. 'vault' for vault.yourdomain.com)."
}

variable "gcs_cname_target" {
  type        = string
  default     = "c.storage.googleapis.com"
  description = "The CNAME target endpoint for GCS static hosting."
}
variable "project_id" {
  type        = string
  description = "The Google Cloud Project ID (used for GCS bucket and Terraform state backend)."
}
variable "region" {
  type        = string
  default     = "europe-central2"
  description = "GCP Region for the provider setup (used for Terraform state backend)."
}
