variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  description = "The Cloudflare API Token with DNS Zone Edit permissions."
}

variable "cloudflare_zone_id" {
  type        = string
  description = "The Zone ID of your domain in Cloudflare."
}

variable "cloudflare_account_id" {
  type        = string
  description = "The account ID of cloudflare"
}

variable "region" {
  type        = string
  default     = "europe-central2"
  description = "GCP Region for the provider setup (used for Terraform state backend)."
}
variable "project_id" {
  type    = string
  default = "GCP project id"
}
