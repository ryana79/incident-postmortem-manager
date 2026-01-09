// ─────────────────────────────────────────────────────────────────────────────
// Azure Kubernetes Service (AKS) Cluster
// Note: AKS is NOT free. Use only for demos, then delete to avoid charges.
// Deploy with: az deployment group create -g <rg-name> -f aks.bicep
// ─────────────────────────────────────────────────────────────────────────────

@description('Project name for resource naming')
param projectName string = 'postmortem'

@description('Azure region')
param location string = resourceGroup().location

@description('Environment (dev/prod)')
@allowed(['dev', 'prod'])
param env string = 'dev'

@description('Node count for the default pool')
param nodeCount int = 2

@description('VM size for nodes')
param vmSize string = 'Standard_B2s'  // Cheapest option

// ─────────────────────────────────────────────────────────────────────────────
// Variables
// ─────────────────────────────────────────────────────────────────────────────

var suffix = toLower('${env}-${uniqueString(resourceGroup().id)}')
var clusterName = '${projectName}-${suffix}-aks'
var acrName = toLower(replace('${projectName}${suffix}acr', '-', ''))

// ─────────────────────────────────────────────────────────────────────────────
// Azure Container Registry
// ─────────────────────────────────────────────────────────────────────────────

resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'  // Cheapest option
  }
  properties: {
    adminUserEnabled: true
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Log Analytics Workspace (for monitoring)
// ─────────────────────────────────────────────────────────────────────────────

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${clusterName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AKS Cluster
// ─────────────────────────────────────────────────────────────────────────────

resource aks 'Microsoft.ContainerService/managedClusters@2024-01-01' = {
  name: clusterName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    dnsPrefix: clusterName
    kubernetesVersion: '1.28'
    
    agentPoolProfiles: [
      {
        name: 'nodepool1'
        count: nodeCount
        vmSize: vmSize
        osType: 'Linux'
        mode: 'System'
        enableAutoScaling: true
        minCount: 1
        maxCount: 5
      }
    ]
    
    networkProfile: {
      networkPlugin: 'azure'
      loadBalancerSku: 'standard'
    }
    
    addonProfiles: {
      omsagent: {
        enabled: true
        config: {
          logAnalyticsWorkspaceResourceID: logAnalytics.id
        }
      }
      azurepolicy: {
        enabled: true
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACR Pull Permission for AKS
// ─────────────────────────────────────────────────────────────────────────────

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aks.id, acr.id, 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: aks.properties.identityProfile.kubeletidentity.objectId
    principalType: 'ServicePrincipal'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────────

output aksName string = aks.name
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer

output kubectlCommand string = 'az aks get-credentials -g ${resourceGroup().name} -n ${aks.name}'
output dockerPushCommand string = 'az acr login -n ${acr.name} && docker tag postmortem-api ${acr.properties.loginServer}/postmortem-api:latest && docker push ${acr.properties.loginServer}/postmortem-api:latest'

