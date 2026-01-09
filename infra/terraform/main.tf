# ─────────────────────────────────────────────────────────────────────────────
# Incident Postmortem Manager - Terraform Configuration
# Equivalent to the Bicep templates in ../main.bicep
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Variables
# ─────────────────────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "postmortem"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "centralus"
}

variable "environment" {
  description = "Environment name (dev or prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be 'dev' or 'prod'."
  }
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Locals
# ─────────────────────────────────────────────────────────────────────────────

locals {
  rg_name       = var.resource_group_name != "" ? var.resource_group_name : "rg-${var.project_name}-${var.environment}"
  suffix        = "${var.environment}-${random_string.unique.result}"
  app_name      = lower("${var.project_name}-${local.suffix}")
  storage_name  = lower(substr(replace("st${var.project_name}${var.environment}${random_string.unique.result}", "-", ""), 0, 24))
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Random String for Unique Names
# ─────────────────────────────────────────────────────────────────────────────

resource "random_string" "unique" {
  length  = 8
  special = false
  upper   = false
}

# ─────────────────────────────────────────────────────────────────────────────
# Resource Group
# ─────────────────────────────────────────────────────────────────────────────

resource "azurerm_resource_group" "main" {
  name     = local.rg_name
  location = var.location
  tags     = local.common_tags
}

# ─────────────────────────────────────────────────────────────────────────────
# Application Insights
# ─────────────────────────────────────────────────────────────────────────────

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${local.app_name}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.common_tags
}

resource "azurerm_application_insights" "main" {
  name                = "${local.app_name}-ai"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
  tags                = local.common_tags
}

# ─────────────────────────────────────────────────────────────────────────────
# Cosmos DB Account (Free Tier)
# ─────────────────────────────────────────────────────────────────────────────

resource "azurerm_cosmosdb_account" "main" {
  name                = "${local.app_name}-cosmos"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"
  
  # Enable free tier (only one per subscription)
  enable_free_tier = true
  
  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = azurerm_resource_group.main.location
    failover_priority = 0
  }

  tags = local.common_tags
}

resource "azurerm_cosmosdb_sql_database" "main" {
  name                = "appdb"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  throughput          = 400
}

resource "azurerm_cosmosdb_sql_container" "incidents" {
  name                = "incidents"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_path  = "/tenantId"

  indexing_policy {
    indexing_mode = "consistent"

    included_path {
      path = "/*"
    }

    excluded_path {
      path = "/\"_etag\"/?"
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Storage Account (for Function App)
# ─────────────────────────────────────────────────────────────────────────────

resource "azurerm_storage_account" "main" {
  name                     = local.storage_name
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
  
  allow_nested_items_to_be_public = false
  
  tags = local.common_tags
}

# ─────────────────────────────────────────────────────────────────────────────
# Function App (Consumption Plan - Free)
# ─────────────────────────────────────────────────────────────────────────────

resource "azurerm_service_plan" "main" {
  name                = "${local.app_name}-plan"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = "Y1"  # Consumption plan (free tier)
  tags                = local.common_tags
}

resource "azurerm_linux_function_app" "main" {
  name                = "${local.app_name}-api"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.main.id

  storage_account_name       = azurerm_storage_account.main.name
  storage_account_access_key = azurerm_storage_account.main.primary_access_key

  https_only = true

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_stack {
      node_version = "20"
    }
    
    cors {
      allowed_origins = ["*"]
    }
  }

  app_settings = {
    "FUNCTIONS_EXTENSION_VERSION"         = "~4"
    "FUNCTIONS_WORKER_RUNTIME"            = "node"
    "WEBSITE_NODE_DEFAULT_VERSION"        = "~20"
    "APPINSIGHTS_INSTRUMENTATIONKEY"      = azurerm_application_insights.main.instrumentation_key
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.main.connection_string
    "COSMOS_ENDPOINT"                     = azurerm_cosmosdb_account.main.endpoint
    "COSMOS_KEY"                          = azurerm_cosmosdb_account.main.primary_key
    "COSMOS_DATABASE_NAME"                = azurerm_cosmosdb_sql_database.main.name
    "COSMOS_CONTAINER_NAME"               = azurerm_cosmosdb_sql_container.incidents.name
  }

  tags = local.common_tags
}

# ─────────────────────────────────────────────────────────────────────────────
# Static Web App (Free Tier)
# ─────────────────────────────────────────────────────────────────────────────

resource "azurerm_static_web_app" "main" {
  name                = "${local.app_name}-web"
  location            = "centralus"  # SWA has limited regions
  resource_group_name = azurerm_resource_group.main.name
  sku_tier            = "Free"
  sku_size            = "Free"
  tags                = local.common_tags
}

# ─────────────────────────────────────────────────────────────────────────────
# Outputs
# ─────────────────────────────────────────────────────────────────────────────

output "resource_group_name" {
  description = "The name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "function_app_name" {
  description = "The name of the Function App"
  value       = azurerm_linux_function_app.main.name
}

output "function_app_url" {
  description = "The URL of the Function App"
  value       = "https://${azurerm_linux_function_app.main.default_hostname}"
}

output "static_web_app_name" {
  description = "The name of the Static Web App"
  value       = azurerm_static_web_app.main.name
}

output "static_web_app_url" {
  description = "The URL of the Static Web App"
  value       = "https://${azurerm_static_web_app.main.default_host_name}"
}

output "cosmos_endpoint" {
  description = "The Cosmos DB endpoint"
  value       = azurerm_cosmosdb_account.main.endpoint
}

output "app_insights_connection_string" {
  description = "Application Insights connection string"
  value       = azurerm_application_insights.main.connection_string
  sensitive   = true
}

output "storage_account_name" {
  description = "The name of the storage account"
  value       = azurerm_storage_account.main.name
}

