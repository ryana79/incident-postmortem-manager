# Incident Postmortem Manager (Azure)

An Azure-first, 3-tier application to create and manage incident postmortems: incident timeline, customer impact, contributing factors, action items, and exportable writeups.

![Azure](https://img.shields.io/badge/Azure-0078D4?style=flat&logo=microsoftazure&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![Bicep](https://img.shields.io/badge/IaC-Bicep-orange)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Azure Cloud                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐ │
│   │   Static Web     │    │  Azure Functions │    │    Cosmos DB     │ │
│   │      Apps        │───▶│   (Node.js 20)   │───▶│   (Free Tier)    │ │
│   │   React + Vite   │    │   Managed ID     │    │   NoSQL / SQL    │ │
│   └──────────────────┘    └──────────────────┘    └──────────────────┘ │
│           │                        │                                    │
│           │                        ▼                                    │
│           │               ┌──────────────────┐                         │
│           └──────────────▶│ App Insights     │                         │
│                           │ (Monitoring)     │                         │
│                           └──────────────────┘                         │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  GitHub Actions: Build → Test → Bicep what-if → Deploy          │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Tech Stack
| Layer | Technology | Why |
|-------|------------|-----|
| **Frontend** | Azure Static Web Apps, React, Vite | Free tier, global CDN, built-in auth |
| **API** | Azure Functions (Consumption), TypeScript | Serverless, scales to zero, free grant |
| **Database** | Cosmos DB (SQL API) | Free tier (1000 RU/s), global distribution |
| **Auth** | Static Web Apps built-in + Managed Identity | No secrets in code, RBAC |
| **IaC** | Bicep | Azure-native, type-safe, readable |
| **CI/CD** | GitHub Actions | Free for public repos, Azure integration |
| **Monitoring** | Application Insights | Traces, logs, dashboards, alerts |

## Features
- Create incidents (title, severity, status, dates, services impacted)
- Timeline events (what happened, when, who)
- Action items (owner, due date, status)
- Audit log (who changed what)
- Export postmortem to Markdown

## Repo layout
- `infra/`: Bicep templates + parameters
- `api/`: Azure Functions (TypeScript)
- `web/`: React (Vite) frontend
- `.github/workflows/`: CI/CD

## Local dev (quick start)
### Prereqs
- Node.js 20+
- Azure Functions Core Tools v4

### Run API
```bash
cd api
npm install
npm run dev
```

### Run Web
```bash
cd web
npm install
npm run dev
```

## Deploy (Azure)

See **[DEPLOY.md](DEPLOY.md)** for the full deployment guide.

**Quick start:**
```bash
# 1. Login
az login

# 2. Create resource group
az group create --name rg-postmortem-dev --location eastus

# 3. Deploy infrastructure
az deployment group create \
  --resource-group rg-postmortem-dev \
  --template-file infra/main.bicep \
  --parameters env=dev

# 4. Deploy API
cd api && npm ci && npm run build
func azure functionapp publish <FUNCTION_APP_NAME>

# 5. Deploy web (via GitHub Actions or SWA CLI)
```

**Cleanup (avoid charges):**
```bash
az group delete --name rg-postmortem-dev --yes --no-wait
```

## Resume Bullets (copy/paste for LinkedIn/resume)

> Built a production-style **incident postmortem management** platform on **Azure Static Web Apps + Azure Functions + Cosmos DB**, deployed via **Bicep** and **GitHub Actions**.

> Implemented **least-privilege access** using **Managed Identity + RBAC**, eliminating hardcoded secrets for data access.

> Designed **Infrastructure as Code** with **Azure Bicep**, enabling repeatable deployments with `what-if` validation in CI.

> Integrated **Application Insights** for distributed tracing, custom dashboards, and alerting on API latency/error thresholds.

> Delivered a polished React UI with timeline visualization, action item tracking, and **Markdown export** for postmortem reports.

## Skills Demonstrated

- **Azure Services:** Static Web Apps, Functions (Consumption), Cosmos DB, App Insights, Azure Monitor
- **Security:** Managed Identity, RBAC, no secrets in code
- **IaC:** Bicep (ARM alternative), idempotent deployments
- **CI/CD:** GitHub Actions, multi-job pipelines, `what-if` on PRs
- **Full-Stack:** React + TypeScript, REST API design, Zod validation
- **Ops Mindset:** Audit logs, observability, cost-conscious architecture


