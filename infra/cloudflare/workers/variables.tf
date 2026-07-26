variable "cloudflare_zone_api_token" {
  type        = string
  sensitive   = true
  description = "The Cloudflare API Token with Account-level and Zone-level permissions."
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
variable "cloudflare_account_id" {
  type        = string
  description = "The Cloudflare Account ID."
}