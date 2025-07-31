/**
 * Salesforce Components Index
 * Exports all Salesforce-related components for easy importing
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

export { default as SalesforceIntegrationDashboard } from './SalesforceIntegrationDashboard'

// Re-export types that components might need
export type {
  SalesforceConnectionStatus,
  SalesforceSyncJob,
  SalesforceStartSyncRequest,
  SalesforceConfigProps,
  SalesforceSyncDashboardProps
} from '@/types' 