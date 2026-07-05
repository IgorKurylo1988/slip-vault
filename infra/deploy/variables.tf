variable "project_id" {
  description = "The GCP Project ID to deploy resources into"
  type        = string
}

variable "region" {
  description = "The GCP region for Cloud Run and resources"
  type        = string
  default     = "europe-central2"
}

variable "gcs_bucket_name" {
  description = "The name of the GCS bucket for receipts (output from core infra)"
  type        = string
  default     = "slip-vault-receipts"
}

variable "pubsub_topic_name" {
  description = "The name of the Pub/Sub topic (output from core infra)"
  type        = string
}

variable "api_sa_email" {
  description = "Email of the API service account"
  type        = string
}

variable "processor_sa_email" {
  description = "Email of the processor agent service account"
  type        = string
}

variable "notification_sa_email" {
  description = "Email of the notification service account"
  type        = string
}

variable "api_image" {
  description = "Container image URL for the API service"
  type        = string
}

variable "processor_image" {
  description = "Container image URL for the processor agent"
  type        = string
}

variable "notification_image" {
  description = "Container image URL for the notification service"
  type        = string
}

variable "llm_model" {
  description = "Gemini model to use via Vertex AI"
  type        = string
  default     = "vertex_ai/gemini-2.5-flash"
}
