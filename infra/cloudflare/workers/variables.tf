variable "cloudflare_account_api_token" {
  type        = string
  sensitive   = true
  description = "The Cloudflare API Token with Account-level (Workers) permissions."
}

variable "cloudflare_zone_id" {
  type        = string
  description = "The Zone ID of your domain in Cloudflare."
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
