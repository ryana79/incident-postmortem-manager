# Incident Postmortem Manager (Azure)

An Azure-first, 3-tier application to create and manage incident postmortems: incident timeline, customer impact, contributing factors, action items, and exportable writeups — with AI-powered analysis.

![Azure](https://img.shields.io/badge/Azure-0078D4?style=flat&logo=microsoftazure&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![Bicep](https://img.shields.io/badge/IaC-Bicep-orange)
![Terraform](https://img.shields.io/badge/IaC-Terraform-purple)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=flat&logo=kubernetes&logoColor=white)

## Live Demo

🌐 **Website:** https://yellow-water-069414910.2.azurestaticapps.net

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
│   │   + Azure AD     │    │   + Groq AI      │    │                  │ │
│   └──────────────────┘    └──────────────────┘    └──────────────────┘ │
│           │                        │                                    │
│           │                        ▼                                    │
│           │               ┌──────────────────┐                         │
│           └──────────────▶│ App Insights     │                         │
│                           │ + Monitor Alerts │                         │
│                           └──────────────────┘                         │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  GitHub Actions: Build → Test → Coverage → Bicep what-if → Deploy│  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  Optional: AKS Deployment (Docker + Kubernetes + ACR)            │  │
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
| **Auth** | Azure AD / Entra ID | Enterprise identity, RBAC, multi-tenant |
| **AI** | Groq (Llama 3.1) | Fast AI summaries, action suggestions |
| **IaC** | Bicep + Terraform | Azure-native + multi-cloud options |
| **CI/CD** | GitHub Actions | Free for public repos, Azure integration |
| **Monitoring** | Application Insights + Azure Monitor | Dashboards, alerts, distributed tracing |
| **Containers** | Docker + Kubernetes (AKS) | Optional enterprise deployment path |

## Features

### Core Features
- Create incidents (title, severity, status, dates, services impacted)
- Timeline events (what happened, when, who)
- Action items (owner, due date, status)
- Audit log (who changed what)
- Export postmortem to Markdown

### AI-Powered Features
- **Generate Summary:** AI analyzes timeline and creates incident summary
- **Suggest Actions:** AI recommends follow-up action items
- **Generate Report:** AI creates comprehensive postmortem report

### Enterprise Features
- Azure AD / Entra ID authentication
- Multi-tenant data isolation
- Role-based access control (RBAC)
- Operational dashboards and alerts

## Repo Layout

```
├── infra/
│   ├── main.bicep           # Core infrastructure
│   ├── monitoring.bicep     # Dashboards & alerts
│   ├── aks.bicep            # Optional AKS cluster
│   └── terraform/           # Terraform alternative
├── api/
│   ├── src/functions/       # Azure Functions
│   ├── src/test/            # Jest unit tests
│   └── Dockerfile           # Container build
├── web/
│   └── src/                 # React frontend
├── k8s/                     # Kubernetes manifests
├── scripts/                 # Deployment scripts
└── .github/workflows/       # CI/CD pipelines
```

## Local Development

### Prerequisites
- Node.js 20+
- Azure Functions Core Tools v4
- (Optional) Docker

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

### Run Tests
```bash
cd api
npm test              # Run tests
npm run test:coverage # With coverage report
```

## Deployment Options

### Option 1: Serverless (Free Tier)
```bash
# See DEPLOY.md for full instructions
az deployment group create \
  --resource-group rg-postmortem-dev \
  --template-file infra/main.bicep
```

### Option 2: Terraform
```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```

### Option 3: Kubernetes (AKS)
```bash
# Deploy AKS cluster
az deployment group create -f infra/aks.bicep

# Build and push Docker image
docker build -t postmortem-api ./api
az acr login -n <acr-name>
docker push <acr-name>.azurecr.io/postmortem-api

# Deploy to Kubernetes
kubectl apply -k k8s/
```

## Monitoring

Deploy operational dashboards and alerts:
```bash
./scripts/setup-monitoring.sh
```

This creates:
- Request rate dashboard
- Response time monitoring
- Error rate alerts
- Function execution tracking

## Resume Bullets

> **Cloud Engineer** — *Incident Postmortem Manager* (January 2026 – Present)

- Architected and deployed a **production-grade 3-tier application** on **Microsoft Azure** using **Static Web Apps**, **Azure Functions**, and **Cosmos DB**

- Implemented **Infrastructure as Code (IaC)** using both **Azure Bicep** and **Terraform** for cross-platform deployment flexibility

- Configured **least-privilege access** using **Azure Managed Identity** and **RBAC**, eliminating hardcoded secrets

- Built a **serverless REST API** with 14 endpoints using **Azure Functions (Node.js)**, including AI-powered features via external LLM integration

- Established **CI/CD pipelines** with **GitHub Actions** featuring automated builds, test coverage reporting, and Bicep `what-if` validation

- Integrated **Azure Application Insights** with custom dashboards and proactive alerting on API latency and error thresholds

- Implemented **Azure AD/Entra ID authentication** with role-based access control for multi-tenant access

- Containerized application with **Docker** and added **Kubernetes (AKS)** deployment option with horizontal pod autoscaling

- Achieved **$0 operational cost** using Azure free tiers (Consumption Plan, Cosmos DB free tier, Static Web Apps)

## Skills Demonstrated

- **Azure Services:** Static Web Apps, Functions, Cosmos DB, App Insights, Monitor, Entra ID, AKS, ACR
- **Infrastructure as Code:** Azure Bicep, Terraform
- **Containers:** Docker, Kubernetes, Kustomize, Helm-ready
- **Security:** Managed Identity, RBAC, Azure AD, secrets management
- **CI/CD:** GitHub Actions, automated testing, coverage reporting
- **AI/ML:** LLM integration (Groq/Llama), prompt engineering
- **Full-Stack:** React + TypeScript, REST API design, Zod validation
- **Observability:** Distributed tracing, dashboards, alerting, SRE practices
