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
  description = "The unique GCS bucket name for storing digitized receipts"
  type        = string
}

variable "llm_model" {
  description = "Gemini model to use via Vertex AI (e.g. vertex_ai/gemini-2.5-flash)"
  type        = string
  default     = "vertex_ai/gemini-2.5-flash"
}
