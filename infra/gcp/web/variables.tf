variable "project_id" {
  type        = string
  description = "The Google Cloud Project ID"
}

variable "region" {
  type        = string
  default     = "europe-central2"
  description = "GCP Region for the provider setup"
}

variable "bucket_location" {
  type        = string
  default     = "EU"
  description = "The GCS location for the bucket (US, EU, ASIA or multi-region)"
}