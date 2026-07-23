data "terraform_remote_state" "gcp_api" {
  backend = "gcs"
  config = {
    bucket = "slip-vault-tf-cm-data"
    prefix = "gcp/application/api"
  }
}

data "terraform_remote_state" "gcp_notification" {
  backend = "gcs"
  config = {
    bucket = "slip-vault-tf-cm-data"
    prefix = "gcp/application/notification"
  }
}

resource "cloudflare_worker_script" "api_proxy" {
  name = "api-proxy"
  content = <<EOT
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  url.hostname = "${replace(replace(data.terraform_remote_state.gcp_api.outputs.api_service_url, "https://", ""), "/", "")}"
  
  const modifiedRequest = new Request(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: "manual"
  })
  
  return fetch(modifiedRequest)
}
EOT
}

resource "cloudflare_worker_route" "api_route" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "api.slip-vault.com/*"
  script_name = cloudflare_worker_script.api_proxy.name
}

resource "cloudflare_worker_script" "notification_proxy" {
  name = "notification-proxy"
  content = <<EOT
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  url.hostname = "${replace(replace(data.terraform_remote_state.gcp_notification.outputs.notification_service_url, "https://", ""), "/", "")}"
  
  const modifiedRequest = new Request(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: "manual"
  })
  
  return fetch(modifiedRequest)
}
EOT
}

resource "cloudflare_worker_route" "notification_route" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "notifications.slip-vault.com/*"
  script_name = cloudflare_worker_script.notification_proxy.name
}
