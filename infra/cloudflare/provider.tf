terraform {
  required_version = ">= 1.0.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
provider "google" {
  project = var.project_id
  region  = var.region
}