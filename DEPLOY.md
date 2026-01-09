# Deployment Guide

This guide walks you through deploying the Incident Postmortem Manager to Azure.

## Prerequisites

1. **Azure for Students** (or Azure Free Account) with active subscription
2. **Azure CLI** installed (`az --version`)
3. **Node.js 20+** installed
4. **GitHub account** for CI/CD

## Quick Deploy (Manual)

### 1. Login to Azure

```bash
az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"
```

### 2. Create Resource Group

```bash
az group create --name rg-postmortem-dev --location eastus
```

### 3. Deploy Infrastructure

```bash
cd infra
az deployment group create \
  --resource-group rg-postmortem-dev \
  --template-file main.bicep \
  --parameters env=dev
```

Save the outputs (Cosmos endpoint, Function App name, etc.).

### 4. Deploy API (Azure Functions)

```bash
cd api
npm install
npm run build

# Deploy using Azure Functions Core Tools
func azure functionapp publish <FUNCTION_APP_NAME>
```

### 5. Create Static Web App (Portal or CLI)

Option A: Use the Azure Portal to create a Static Web App and connect to your GitHub repo.

Option B: Use CLI:
```bash
az staticwebapp create \
  --name postmortem-web-dev \
  --resource-group rg-postmortem-dev \
  --source https://github.com/<YOUR_USERNAME>/<YOUR_REPO> \
  --branch main \
  --app-location "web" \
  --output-location "dist" \
  --login-with-github
```

### 6. Link API to Static Web App

In the Azure Portal, go to your Static Web App → Configuration → Add the API Function App as a linked backend, or use the SWA CLI for local dev.

## CI/CD Setup (GitHub Actions)

### 1. Create Azure Service Principal

```bash
az ad sp create-for-rbac \
  --name "github-postmortem-deploy" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/rg-postmortem-dev \
  --sdk-auth
```

Copy the JSON output.

### 2. Add GitHub Secrets

In your GitHub repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `AZURE_CREDENTIALS` | The JSON from step 1 |
| `SWA_DEPLOYMENT_TOKEN` | Get from Azure Portal → Static Web App → Manage deployment token |

### 3. Add GitHub Variables

In the same settings page, add Variables:

| Variable | Value |
|----------|-------|
| `AZURE_RG` | `rg-postmortem-dev` |
| `AZURE_LOCATION` | `eastus` (or your preferred region) |

### 4. Push to Main

The workflows will automatically:
- Build and validate on every push/PR
- Deploy infrastructure, API, and web on push to `main`

## Local Development

### Run with Cosmos DB Emulator (optional)

1. Install [Azure Cosmos DB Emulator](https://docs.microsoft.com/en-us/azure/cosmos-db/local-emulator)
2. The default `local.settings.json` is configured for the emulator

### Run without Cosmos (mock mode)

For quick testing, you can modify `api/src/db.ts` to use an in-memory store.

### Start the API

```bash
cd api
npm install
npm run dev
# API runs at http://localhost:7071
```

### Start the Web

```bash
cd web
npm install
npm run dev
# Web runs at http://localhost:5173 (proxies /api to :7071)
```

## Cost Management

**Important:** To avoid charges, delete the resource group when done:

```bash
az group delete --name rg-postmortem-dev --yes --no-wait
```

### Free Tier Limits

| Service | Free Tier |
|---------|-----------|
| Static Web Apps | 100 GB bandwidth, 2 custom domains |
| Azure Functions (Consumption) | 1M executions/month |
| Cosmos DB | 1000 RU/s, 25 GB (first account only) |
| Application Insights | 5 GB/month |

Stay within these limits for $0 cost.

## Troubleshooting

### API returns 500 errors
- Check Application Insights for logs
- Verify Cosmos DB connection string in Function App settings

### CORS errors
- Ensure Static Web App has API linked correctly
- For local dev, the Vite proxy handles CORS

### Bicep deployment fails
- Run `az bicep build --file infra/main.bicep` to check for syntax errors
- Ensure you have Contributor role on the resource group

