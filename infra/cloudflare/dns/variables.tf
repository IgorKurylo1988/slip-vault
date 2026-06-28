variable "cloudflare_zone_api_token" {
  type        = string
  sensitive   = true
  description = "The Cloudflare API Token with Zone-level permissions."
}

variable "cloudflare_zone_id" {
  type        = string
  description = "The Zone ID of your domain in Cloudflare."
}

variable "static_subdomain" {
  type        = string
  default     = "www"
  description = "The subdomain name for the static website."
}

variable "project_id" {
  type        = string
  description = "The Google Cloud Project ID."
}

variable "region" {
  type        = string
  default     = "europe-central2"
  description = "GCP Region for the provider setup."
}
