variable "project_id" {
  type        = string
  description = "The Google Cloud Project ID"
}

variable "region" {
  type        = string
  default     = "europe-central2"
  description = "GCP Region for the provider setup"
}

variable "domain_name" {
  type        = string
  description = "The exact custom domain/subdomain name of your website (e.g., vault.yourdomain.com)"
}

variable "bucket_location" {
  type        = string
  default     = "US"
  description = "The GCS location for the bucket (US, EU, ASIA or multi-region)"
}