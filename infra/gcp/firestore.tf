# =====================================================================
# Firestore Database (Native Serverless Mode)
# =====================================================================
import {
  to = google_firestore_database.database
  id = "projects/lithe-saga-103615/databases/(default)"
}

resource "google_firestore_database" "database" {
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.services]
}
