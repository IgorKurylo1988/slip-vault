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

resource "cloudflare_workers_script" "api_proxy" {
  account_id  = var.cloudflare_account_id
  script_name = "api-proxy"
  content     = <<EOT
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

resource "cloudflare_workers_route" "api_route" {
  zone_id = var.cloudflare_zone_id
  pattern = "api.slip-vault.com/*"
  script  = "api-proxy"
}

resource "cloudflare_workers_script" "notification_proxy" {
  account_id  = var.cloudflare_account_id
  script_name = "notification-proxy"
  content     = <<EOT
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

resource "cloudflare_workers_route" "notification_route" {
  zone_id = var.cloudflare_zone_id
  pattern = "notifications.slip-vault.com/*"
  script  = "notification-proxy"
}

resource "cloudflare_workers_script" "image_proxy" {
  account_id  = var.cloudflare_account_id
  script_name = "image-proxy"
  content     = <<EOT
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request))
})

// Variables injected via wrangler secrets:
// - JWT_SECRET
// - GCS_SA_KEY
// - GCS_BUCKET

function base64UrlEncode(str) {
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
  const pad = '='.repeat((4 - str.length % 4) % 4);
  const base64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

async function signRS256(privateKeyPem, message) {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKeyPem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s+/g, "");
  const binaryDer = base64UrlDecode(pemContents);
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(message)
  );
  
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken(saJson, forceRefresh = false) {
  if (cachedToken && Date.now() < tokenExpiry && !forceRefresh) {
    return cachedToken;
  }
  
  const sa = JSON.parse(saJson);
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3000;
  
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64UrlEncode(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/devstorage.read_only",
    aud: "https://oauth2.googleapis.com/token",
    exp: exp,
    iat: iat
  }));
  
  const signature = await signRS256(sa.private_key, header + "." + claimSet);
  const jwt = header + "." + claimSet + "." + signature;
  
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch access token: $${text}`);
  }
  
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, signatureB64] = parts;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(headerB64 + '.' + payloadB64);
  const secretKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  
  const signature = new Uint8Array(base64UrlDecode(signatureB64));
  const isValid = await crypto.subtle.verify("HMAC", secretKey, signature, data);
  if (!isValid) return false;
  
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    return false;
  }
  return payload;
}

async function handleRequest(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization"
      }
    })
  }

  const url = new URL(request.url)
  let token = "";
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else {
    token = url.searchParams.get("token") || "";
  }
  
  if (!token) {
    return new Response("Missing authorization token", { status: 401 })
  }
  
  const decoded = await verifyJWT(token, JWT_SECRET);
  if (!decoded || !decoded.sub) {
    return new Response("Invalid or expired token", { status: 401 })
  }
  
  const requestUserId = decoded.sub;
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  if (pathParts.length < 1) {
    return new Response("Invalid image request path", { status: 400 })
  }
  
  const fileUserId = pathParts[0];
  if (fileUserId !== requestUserId) {
    return new Response("Access Denied: You do not own this image resource.", { status: 403 })
  }
  
  try {
    const accessToken = await getAccessToken(GCS_SA_KEY);
    const gcsUrl = `https://storage.googleapis.com/$${GCS_BUCKET}$${url.pathname}`;
    const gcsResponse = await fetch(gcsUrl, {
      headers: {
        "Authorization": `Bearer $${accessToken}`
      }
    });
    
    if (!gcsResponse.ok) {
      return new Response("Failed to fetch image from GCS", { status: gcsResponse.status })
    }
    
    const responseHeaders = new Headers(gcsResponse.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Cache-Control", "public, max-age=31536000");
    
    return new Response(gcsResponse.body, {
      status: gcsResponse.status,
      headers: responseHeaders
    });
    
  } catch (err) {
    return new Response(`Proxy error: $${err.message}`, { status: 500 })
  }
}
EOT
}

resource "cloudflare_workers_route" "image_route" {
  zone_id = var.cloudflare_zone_id
  pattern = "assets.slip-vault.com/*"
  script  = "image-proxy"
}
