variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "europe-central2"
}

variable "image_tag" {
  description = "Docker image tag for the notification service"
  type        = string
}
