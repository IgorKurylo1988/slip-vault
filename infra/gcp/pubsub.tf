# =====================================================================
# Pub/Sub Topic for OCR/Agent Tasks
# =====================================================================
resource "google_pubsub_topic" "tasks_topic" {
  name = "slip-vault-tasks-topic"

  depends_on = [google_project_service.services]
}
