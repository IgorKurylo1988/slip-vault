variable "service_name" {
  description = "Name of the Cloud Run service"
  type        = string
}

variable "location" {
  description = "GCP region"
  type        = string
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag (short commit SHA or latest)"
  type        = string
  default     = "latest"
}

variable "repository_name" {
  description = "Artifact Registry repository name"
  type        = string
  default     = "slip-vault-repo"
}

variable "service_account_email" {
  description = "IAM Service Account email for Cloud Run execution"
  type        = string
}

variable "container_port" {
  description = "Port exposed by the container"
  type        = number
  default     = 8080
}

variable "ingress" {
  description = "Ingress traffic setting"
  type        = string
  default     = "INGRESS_TRAFFIC_ALL"
}

variable "allow_unauthenticated" {
  description = "Whether to allow unauthenticated public access"
  type        = bool
  default     = false
}

variable "custom_domain" {
  description = "Custom domain mapping if any"
  type        = string
  default     = ""
}

variable "env_vars" {
  description = "Environment variables map"
  type        = map(string)
  default     = {}
}
