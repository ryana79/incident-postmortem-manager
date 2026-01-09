// ─────────────────────────────────────────────────────────────────────────────
// Azure Monitor Dashboard & Alerts
// Deploy with: az deployment group create -g <rg-name> -f monitoring.bicep
// ─────────────────────────────────────────────────────────────────────────────

@description('Name of the existing Application Insights resource')
param appInsightsName string

@description('Name of the existing Function App')
param functionAppName string

@description('Email address for alert notifications')
param alertEmail string = ''

@description('Azure region')
param location string = resourceGroup().location

// ─────────────────────────────────────────────────────────────────────────────
// Get existing resources
// ─────────────────────────────────────────────────────────────────────────────

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: appInsightsName
}

resource functionApp 'Microsoft.Web/sites@2022-09-01' existing = {
  name: functionAppName
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Group (for alert notifications)
// ─────────────────────────────────────────────────────────────────────────────

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (alertEmail != '') {
  name: 'postmortem-alerts-ag'
  location: 'global'
  properties: {
    groupShortName: 'PMAlerts'
    enabled: true
    emailReceivers: [
      {
        name: 'EmailNotification'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert: High Error Rate (> 5% of requests in 5 min)
// ─────────────────────────────────────────────────────────────────────────────

resource highErrorRateAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'High Error Rate - Postmortem API'
  location: 'global'
  properties: {
    description: 'Alert when API error rate exceeds 5% in 5 minutes'
    severity: 2
    enabled: true
    scopes: [appInsights.id]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighErrorRate'
          metricName: 'requests/failed'
          metricNamespace: 'microsoft.insights/components'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Count'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: alertEmail != '' ? [
      {
        actionGroupId: actionGroup.id
      }
    ] : []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert: Slow Response Time (avg > 2s in 5 min)
// ─────────────────────────────────────────────────────────────────────────────

resource slowResponseAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'Slow Response Time - Postmortem API'
  location: 'global'
  properties: {
    description: 'Alert when average response time exceeds 2 seconds'
    severity: 3
    enabled: true
    scopes: [appInsights.id]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'SlowResponse'
          metricName: 'requests/duration'
          metricNamespace: 'microsoft.insights/components'
          operator: 'GreaterThan'
          threshold: 2000  // 2 seconds in milliseconds
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: alertEmail != '' ? [
      {
        actionGroupId: actionGroup.id
      }
    ] : []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert: Function App Errors
// ─────────────────────────────────────────────────────────────────────────────

resource functionErrorAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'Function Execution Errors - Postmortem API'
  location: 'global'
  properties: {
    description: 'Alert when function executions fail'
    severity: 2
    enabled: true
    scopes: [functionApp.id]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'FunctionErrors'
          metricName: 'FunctionExecutionUnits'
          metricNamespace: 'Microsoft.Web/sites'
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
          dimensions: [
            {
              name: 'FunctionExecutionErrors'
              operator: 'Include'
              values: ['*']
            }
          ]
        }
      ]
    }
    actions: alertEmail != '' ? [
      {
        actionGroupId: actionGroup.id
      }
    ] : []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Azure Dashboard
// ─────────────────────────────────────────────────────────────────────────────

resource dashboard 'Microsoft.Portal/dashboards@2020-09-01-preview' = {
  name: 'postmortem-ops-dashboard'
  location: location
  tags: {
    'hidden-title': 'Postmortem Manager - Operations Dashboard'
  }
  properties: {
    lenses: [
      {
        order: 0
        parts: [
          // Request Rate Chart
          {
            position: {
              x: 0
              y: 0
              colSpan: 6
              rowSpan: 4
            }
            metadata: {
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              inputs: [
                {
                  name: 'options'
                  value: {
                    chart: {
                      title: 'Request Rate'
                      metrics: [
                        {
                          resourceMetadata: {
                            id: appInsights.id
                          }
                          name: 'requests/count'
                          aggregationType: 4  // Count
                          namespace: 'microsoft.insights/components'
                        }
                      ]
                      visualization: {
                        chartType: 2  // Line chart
                      }
                      timespan: {
                        relative: {
                          duration: 86400000  // 24 hours
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
          // Response Time Chart
          {
            position: {
              x: 6
              y: 0
              colSpan: 6
              rowSpan: 4
            }
            metadata: {
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              inputs: [
                {
                  name: 'options'
                  value: {
                    chart: {
                      title: 'Response Time (avg)'
                      metrics: [
                        {
                          resourceMetadata: {
                            id: appInsights.id
                          }
                          name: 'requests/duration'
                          aggregationType: 4  // Average
                          namespace: 'microsoft.insights/components'
                        }
                      ]
                      visualization: {
                        chartType: 2
                      }
                      timespan: {
                        relative: {
                          duration: 86400000
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
          // Failed Requests Chart
          {
            position: {
              x: 0
              y: 4
              colSpan: 6
              rowSpan: 4
            }
            metadata: {
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              inputs: [
                {
                  name: 'options'
                  value: {
                    chart: {
                      title: 'Failed Requests'
                      metrics: [
                        {
                          resourceMetadata: {
                            id: appInsights.id
                          }
                          name: 'requests/failed'
                          aggregationType: 4
                          namespace: 'microsoft.insights/components'
                        }
                      ]
                      visualization: {
                        chartType: 2
                      }
                      timespan: {
                        relative: {
                          duration: 86400000
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
          // Server Exceptions
          {
            position: {
              x: 6
              y: 4
              colSpan: 6
              rowSpan: 4
            }
            metadata: {
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              inputs: [
                {
                  name: 'options'
                  value: {
                    chart: {
                      title: 'Server Exceptions'
                      metrics: [
                        {
                          resourceMetadata: {
                            id: appInsights.id
                          }
                          name: 'exceptions/count'
                          aggregationType: 4
                          namespace: 'microsoft.insights/components'
                        }
                      ]
                      visualization: {
                        chartType: 2
                      }
                      timespan: {
                        relative: {
                          duration: 86400000
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
        ]
      }
    ]
    metadata: {
      model: {}
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────────

output dashboardId string = dashboard.id
output actionGroupId string = alertEmail != '' ? actionGroup.id : ''

