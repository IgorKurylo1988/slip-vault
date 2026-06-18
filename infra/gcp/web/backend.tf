terraform {
  backend "gcs" {
    bucket = "slip-vault-tf-cm-data"
    prefix = "web"
    key    = "terraform.tfstate"
  }
}