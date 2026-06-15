terraform {
    backend "gcs" {
        bucket = "slip-vault-tf-cm-data"
        prefix = "web"
    }
}