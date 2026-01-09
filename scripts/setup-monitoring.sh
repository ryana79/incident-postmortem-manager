#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy Azure Monitor Dashboard & Alerts
# ─────────────────────────────────────────────────────────────────────────────

set -e

# Configuration
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-postmortem-central}"
APP_INSIGHTS_NAME="${APP_INSIGHTS_NAME:-postmortem-dev-uixauh3woqkza-ai}"
FUNCTION_APP_NAME="${FUNCTION_APP_NAME:-postmortem-dev-uixauh3woqkza-api}"
ALERT_EMAIL="${ALERT_EMAIL:-}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   Deploying Azure Monitor Dashboard & Alerts                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Resource Group:     $RESOURCE_GROUP"
echo "App Insights:       $APP_INSIGHTS_NAME"
echo "Function App:       $FUNCTION_APP_NAME"
echo "Alert Email:        ${ALERT_EMAIL:-'(not configured)'}"
echo ""

# Deploy monitoring resources
echo "▸ Deploying monitoring resources..."
az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$(dirname "$0")/../infra/monitoring.bicep" \
  --parameters \
    appInsightsName="$APP_INSIGHTS_NAME" \
    functionAppName="$FUNCTION_APP_NAME" \
    alertEmail="$ALERT_EMAIL" \
  --query "properties.outputs" \
  --output table

echo ""
echo "✓ Monitoring deployment complete!"
echo ""
echo "Dashboard URL:"
echo "  https://portal.azure.com/#@/dashboard/arm/subscriptions/{sub-id}/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Portal/dashboards/postmortem-ops-dashboard"
echo ""
echo "To view alerts:"
echo "  az monitor metrics alert list -g $RESOURCE_GROUP -o table"

