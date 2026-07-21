variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "europe-north1"
}

variable "gcs_bucket_name" {
  description = "The name of the GCS bucket for receipts"
  type        = string
  default     = "slip-vault-receipts"
}

variable "pubsub_topic_name" {
  description = "The name of the Pub/Sub topic"
  type        = string
  default     = "slip-vault-tasks-topic"
}

variable "image_tag" {
  description = "Docker image tag for the API service"
  type        = string
}
