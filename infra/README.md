# GCP Deployment Guide (GitHub Actions & Terraform CI/CD)

This guide explains how to set up the Google Cloud Platform (GCP) Service Account and GitHub Secrets required to build, push, and deploy the Slip Vault application using the provided CI/CD workflows.

---

## 1. Configure GitHub Actions Secrets

Add the following secrets to your GitHub repository under **Settings > Secrets and variables > Actions**:

| Secret Name | Description | Example Value |
| :--- | :--- | :--- |
| `GCP_PROJECT_ID` | Your Google Cloud Project ID | `slip-vault-project` |
| `GCP_REGION` | The default deployment region | `europe-central2` |
| `GCP_GCS_BUCKET` | The GCS bucket name for storing receipt scans | `slip-vault-receipts-bucket` |
| `GCP_SA_KEY` | The JSON private key of the deployer Service Account | `{"type": "service_account", ...}` |

---

## 2. Enable GCP APIs

Ensure the following API services are enabled in your GCP project. You can enable them via the GCP Console or run:

```bash
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  pubsub.googleapis.com \
  aiplatform.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com
```

---

## 3. Create Service Account & Assign Roles

Run the following script using the Google Cloud SDK (`gcloud` CLI) to create the CI/CD service account, assign the required permissions, and export the private key.

### Step 1: Define Project and SA Variables
```bash
export PROJECT_ID="YOUR_GCP_PROJECT_ID"
export SA_NAME="slip-vault-deployer"
export SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
```

### Step 2: Create the Service Account
```bash
gcloud iam service-accounts create $SA_NAME \
    --description="Service Account for Slip Vault GitHub Actions Deployer" \
    --display-name="Slip Vault Deployer"
```

### Step 3: Grant IAM Roles
Execute these commands to grant the service account all permission scopes needed to configure databases, storage, messaging, IAM policies, and Cloud Run:

```bash
# Enable API service activation
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/serviceusage.serviceUsageAdmin"

# Manage Service Accounts and IAM Policies
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/resourcemanager.projectIamAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/iam.serviceAccountAdmin"

# Deploy & run Cloud Run services
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/iam.serviceAccountUser"

# Manage persistent database & storage
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/datastore.owner"

# Configure Pub/Sub triggers & queues
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/pubsub.admin"

# Push compiled Docker images to Artifact Registry
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/artifactregistry.admin"
```

### Step 4: Export JSON Private Key
Export the credentials file, copy the content, and save it in your GitHub repository as the `GCP_SA_KEY` secret:

```bash
gcloud iam service-accounts keys create gcp-key.json \
    --iam-account=$SA_EMAIL
```

*Note: Delete `gcp-key.json` locally once it has been saved to GitHub Secrets to avoid exposing credentials.*
