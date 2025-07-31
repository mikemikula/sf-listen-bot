/**
 * Salesforce Deployment Strategies
 * Multiple approaches for deploying custom objects based on best practices
 * 
 * Based on insights from: https://bluecanvas.io/blog/practical-deployment-tips-from-a-salesforce-developer
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { logger } from './logger'
import type { 
  SalesforceTokenResponse, 
  SalesforceUserInfo
} from '@/types'

/**
 * Manual deployment metadata files generator
 * Creates files that can be deployed via Salesforce CLI or Workbench
 */
export class SalesforceManualDeploymentGenerator {
  private tokenResponse: SalesforceTokenResponse
  private userInfo: SalesforceUserInfo

  constructor(tokenResponse: SalesforceTokenResponse, userInfo: SalesforceUserInfo) {
    this.tokenResponse = tokenResponse
    this.userInfo = userInfo
  }

  /**
   * Generate deployment package files for manual deployment
   * Following best practices: Objects > Apex Classes > VF Components > VF Pages > Triggers > Profiles
   */
  async generateDeploymentPackage(): Promise<{
    success: boolean
    files: {
      [filename: string]: string
    }
    instructions: string[]
    error?: string
  }> {
    try {
      logger.info('Generating manual deployment package', {
        orgId: this.userInfo.organization_id,
        approach: 'Manual Deployment Files'
      })

      const files: { [filename: string]: string } = {}
      
      // Step 1: Generate package.xml
      files['package.xml'] = this.generatePackageXML()
      
      // Step 2: Generate custom object metadata (Objects first - best practice)
      files['objects/Slack_Document__c.object'] = this.generateDocumentObjectXML()
      files['objects/Slack_FAQ__c.object'] = this.generateFaqObjectXML()
      
      // Step 3: Generate field metadata files (separate files for better control)
      const documentFields = this.getDocumentFieldsMetadata()
      documentFields.forEach(field => {
        files[`objects/Slack_Document__c/fields/${field.name}.field-meta.xml`] = field.xml
      })
      
      const faqFields = this.getFaqFieldsMetadata()
      faqFields.forEach(field => {
        files[`objects/Slack_FAQ__c/fields/${field.name}.field-meta.xml`] = field.xml
      })

      // Generate deployment instructions
      const instructions = this.generateDeploymentInstructions()

      logger.info('Manual deployment package generated successfully', {
        fileCount: Object.keys(files).length,
        instructionSteps: instructions.length
      })

      return {
        success: true,
        files,
        instructions
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to generate deployment package', {
        error: errorMessage,
        orgId: this.userInfo.organization_id
      })

      return {
        success: false,
        files: {},
        instructions: [],
        error: errorMessage
      }
    }
  }

  /**
   * Generate package.xml following Salesforce best practices
   */
  private generatePackageXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <!-- Step 1: Deploy Objects First (Best Practice) -->
    <types>
        <members>Slack_Document__c</members>
        <members>Slack_FAQ__c</members>
        <name>CustomObject</name>
    </types>
    
    <!-- Step 2: Deploy Custom Fields (After Objects) -->
    <types>
        <members>Slack_Document__c.Document_ID__c</members>
        <members>Slack_Document__c.Title__c</members>
        <members>Slack_Document__c.Content__c</members>
        <members>Slack_Document__c.Channel_Name__c</members>
        <members>Slack_Document__c.Author__c</members>
        <members>Slack_Document__c.Source_URL__c</members>
        <members>Slack_Document__c.Tags__c</members>
        <members>Slack_Document__c.Word_Count__c</members>
        <members>Slack_Document__c.Processed_Date__c</members>
        <members>Slack_Document__c.Status__c</members>
        <members>Slack_FAQ__c.FAQ_ID__c</members>
        <members>Slack_FAQ__c.Question__c</members>
        <members>Slack_FAQ__c.Answer__c</members>
        <members>Slack_FAQ__c.Category__c</members>
        <members>Slack_FAQ__c.Source_Document__c</members>
        <members>Slack_FAQ__c.Channel_Name__c</members>
        <members>Slack_FAQ__c.Confidence_Score__c</members>
        <members>Slack_FAQ__c.View_Count__c</members>
        <members>Slack_FAQ__c.Helpful_Count__c</members>
        <members>Slack_FAQ__c.Generated_Date__c</members>
        <members>Slack_FAQ__c.Last_Updated__c</members>
        <members>Slack_FAQ__c.Status__c</members>
        <name>CustomField</name>
    </types>
    
    <version>59.0</version>
</Package>`
  }

  /**
   * Generate Slack Document custom object XML
   */
  private generateDocumentObjectXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Slack Document</label>
    <pluralLabel>Slack Documents</pluralLabel>
    <description>Documents processed from Slack channels</description>
    <deploymentStatus>Deployed</deploymentStatus>
    <sharingModel>ReadWrite</sharingModel>
    <enableActivities>true</enableActivities>
    <enableReports>true</enableReports>
    <enableSearch>true</enableSearch>
    <enableSharing>true</enableSharing>
    <enableBulkApi>true</enableBulkApi>
    <enableStreamingApi>true</enableStreamingApi>
    <nameField>
        <type>AutoNumber</type>
        <label>Document Number</label>
        <displayFormat>DOC-{00000}</displayFormat>
        <startingNumber>1</startingNumber>
    </nameField>
</CustomObject>`
  }

  /**
   * Generate Slack FAQ custom object XML
   */
  private generateFaqObjectXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Slack FAQ</label>
    <pluralLabel>Slack FAQs</pluralLabel>
    <description>Frequently Asked Questions generated from Slack conversations</description>
    <deploymentStatus>Deployed</deploymentStatus>
    <sharingModel>ReadWrite</sharingModel>
    <enableActivities>true</enableActivities>
    <enableReports>true</enableReports>
    <enableSearch>true</enableSearch>
    <enableSharing>true</enableSharing>
    <enableBulkApi>true</enableBulkApi>
    <enableStreamingApi>true</enableStreamingApi>
    <nameField>
        <type>AutoNumber</type>
        <label>FAQ Number</label>
        <displayFormat>FAQ-{00000}</displayFormat>
        <startingNumber>1</startingNumber>
    </nameField>
</CustomObject>`
  }

  /**
   * Get document fields metadata
   */
  private getDocumentFieldsMetadata(): { name: string; xml: string }[] {
    return [
      {
        name: 'Document_ID__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Document_ID__c</fullName>
    <label>Document ID</label>
    <type>Text</type>
    <length>255</length>
    <unique>true</unique>
    <externalId>true</externalId>
    <required>true</required>
    <description>Unique identifier from the source system</description>
</CustomField>`
      },
      {
        name: 'Title__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Title__c</fullName>
    <label>Title</label>
    <type>Text</type>
    <length>255</length>
    <required>true</required>
    <description>Document title or subject</description>
</CustomField>`
      },
      {
        name: 'Content__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Content__c</fullName>
    <label>Content</label>
    <type>LongTextArea</type>
    <length>32768</length>
    <visibleLines>10</visibleLines>
    <description>Full document content</description>
</CustomField>`
      },
      {
        name: 'Channel_Name__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Channel_Name__c</fullName>
    <label>Channel Name</label>
    <type>Text</type>
    <length>100</length>
    <description>Slack channel where document originated</description>
</CustomField>`
      },
      {
        name: 'Author__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Author__c</fullName>
    <label>Author</label>
    <type>Text</type>
    <length>100</length>
    <description>Document author or creator</description>
</CustomField>`
      },
      {
        name: 'Source_URL__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Source_URL__c</fullName>
    <label>Source URL</label>
    <type>Url</type>
    <description>Link to original document or message</description>
</CustomField>`
      },
      {
        name: 'Tags__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Tags__c</fullName>
    <label>Tags</label>
    <type>Text</type>
    <length>500</length>
    <description>Comma-separated tags for categorization</description>
</CustomField>`
      },
      {
        name: 'Word_Count__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Word_Count__c</fullName>
    <label>Word Count</label>
    <type>Number</type>
    <precision>10</precision>
    <scale>0</scale>
    <description>Number of words in the document</description>
</CustomField>`
      },
      {
        name: 'Processed_Date__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Processed_Date__c</fullName>
    <label>Processed Date</label>
    <type>DateTime</type>
    <required>true</required>
    <description>When the document was processed and synced</description>
</CustomField>`
      },
      {
        name: 'Status__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Status__c</fullName>
    <label>Status</label>
    <type>Picklist</type>
    <description>Processing status of the document</description>
    <valueSet>
        <restricted>true</restricted>
        <valueSetDefinition>
            <value>
                <fullName>Draft</fullName>
                <default>true</default>
                <label>Draft</label>
            </value>
            <value>
                <fullName>Processed</fullName>
                <default>false</default>
                <label>Processed</label>
            </value>
            <value>
                <fullName>Published</fullName>
                <default>false</default>
                <label>Published</label>
            </value>
            <value>
                <fullName>Archived</fullName>
                <default>false</default>
                <label>Archived</label>
            </value>
        </valueSetDefinition>
    </valueSet>
</CustomField>`
      }
    ]
  }

  /**
   * Get FAQ fields metadata
   */
  private getFaqFieldsMetadata(): { name: string; xml: string }[] {
    return [
      {
        name: 'FAQ_ID__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>FAQ_ID__c</fullName>
    <label>FAQ ID</label>
    <type>Text</type>
    <length>255</length>
    <unique>true</unique>
    <externalId>true</externalId>
    <required>true</required>
    <description>Unique identifier for the FAQ</description>
</CustomField>`
      },
      {
        name: 'Question__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Question__c</fullName>
    <label>Question</label>
    <type>Text</type>
    <length>500</length>
    <required>true</required>
    <description>The frequently asked question</description>
</CustomField>`
      },
      {
        name: 'Answer__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Answer__c</fullName>
    <label>Answer</label>
    <type>LongTextArea</type>
    <length>32768</length>
    <visibleLines>10</visibleLines>
    <required>true</required>
    <description>The answer to the question</description>
</CustomField>`
      },
      {
        name: 'Category__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Category__c</fullName>
    <label>Category</label>
    <type>Text</type>
    <length>100</length>
    <description>FAQ category for organization</description>
</CustomField>`
      },
      {
        name: 'Source_Document__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Source_Document__c</fullName>
    <label>Source Document</label>
    <type>Lookup</type>
    <referenceTo>Slack_Document__c</referenceTo>
    <relationshipLabel>FAQs</relationshipLabel>
    <relationshipName>FAQs</relationshipName>
    <description>Related source document</description>
</CustomField>`
      },
      {
        name: 'Channel_Name__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Channel_Name__c</fullName>
    <label>Channel Name</label>
    <type>Text</type>
    <length>100</length>
    <description>Slack channel where FAQ originated</description>
</CustomField>`
      },
      {
        name: 'Confidence_Score__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Confidence_Score__c</fullName>
    <label>Confidence Score</label>
    <type>Number</type>
    <precision>5</precision>
    <scale>2</scale>
    <description>AI confidence score for the FAQ (0-100)</description>
</CustomField>`
      },
      {
        name: 'View_Count__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>View_Count__c</fullName>
    <label>View Count</label>
    <type>Number</type>
    <precision>10</precision>
    <scale>0</scale>
    <defaultValue>0</defaultValue>
    <description>Number of times this FAQ has been viewed</description>
</CustomField>`
      },
      {
        name: 'Helpful_Count__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Helpful_Count__c</fullName>
    <label>Helpful Count</label>
    <type>Number</type>
    <precision>10</precision>
    <scale>0</scale>
    <defaultValue>0</defaultValue>
    <description>Number of times marked as helpful</description>
</CustomField>`
      },
      {
        name: 'Generated_Date__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Generated_Date__c</fullName>
    <label>Generated Date</label>
    <type>DateTime</type>
    <required>true</required>
    <description>When the FAQ was generated</description>
</CustomField>`
      },
      {
        name: 'Last_Updated__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Last_Updated__c</fullName>
    <label>Last Updated</label>
    <type>DateTime</type>
    <description>When the FAQ was last updated</description>
</CustomField>`
      },
      {
        name: 'Status__c',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Status__c</fullName>
    <label>Status</label>
    <type>Picklist</type>
    <description>FAQ status</description>
    <valueSet>
        <restricted>true</restricted>
        <valueSetDefinition>
            <value>
                <fullName>Draft</fullName>
                <default>true</default>
                <label>Draft</label>
            </value>
            <value>
                <fullName>Review</fullName>
                <default>false</default>
                <label>Under Review</label>
            </value>
            <value>
                <fullName>Published</fullName>
                <default>false</default>
                <label>Published</label>
            </value>
            <value>
                <fullName>Archived</fullName>
                <default>false</default>
                <label>Archived</label>
            </value>
        </valueSetDefinition>
    </valueSet>
</CustomField>`
      }
    ]
  }

  /**
   * Generate step-by-step deployment instructions
   */
  private generateDeploymentInstructions(): string[] {
    return [
      "🎯 SALESFORCE DEPLOYMENT INSTRUCTIONS",
      "",
      "⏰ TIMING: Deploy during off-peak hours to avoid user conflicts",
      "📋 ORDER: Follow the sequence below for best results",
      "",
      "📦 METHOD 1: Salesforce CLI (Recommended)",
      "1. Create a new directory: mkdir salesforce-deployment && cd salesforce-deployment",
      "2. Copy all generated files maintaining the folder structure",
      "3. Run: sf project deploy start -x package.xml -o your-org-alias",
      "4. Monitor deployment: sf project deploy report -o your-org-alias",
      "",
      "📦 METHOD 2: Workbench (Alternative)",
      "1. Zip all files maintaining the folder structure",
      "2. Go to workbench.developerforce.com",
      "3. Login with your Salesforce credentials",
      "4. Navigate to: Migration > Deploy",
      "5. Upload the zip file and check 'Single Package'",
      "6. Click Deploy and monitor progress",
      "",
      "📦 METHOD 3: Change Sets (Manual)",
      "1. Create a new outbound change set in source org",
      "2. Add objects first: Slack_Document__c, Slack_FAQ__c",
      "3. Add all custom fields in separate change set",
      "4. Upload and deploy change sets in order",
      "",
      "⚠️  DEPLOYMENT ORDER (CRITICAL):",
      "   Step 1: Deploy Slack_Document__c object",
      "   Step 2: Deploy all Slack_Document__c fields",
      "   Step 3: Deploy Slack_FAQ__c object", 
      "   Step 4: Deploy all Slack_FAQ__c fields",
      "",
      "🔍 VALIDATION CHECKLIST:",
      "✅ All objects appear in Object Manager",
      "✅ All fields are visible on object details",
      "✅ Lookup relationship works (FAQ > Document)",
      "✅ Picklist values are correctly configured",
      "✅ Page layouts include new fields (if needed)",
      "",
      "🚨 ROLLBACK PLAN:",
      "1. Document current state before deployment",
      "2. If deployment fails, use destructive changes to remove objects",
      "3. Keep backup of org configuration",
      "",
      "📞 SUPPORT:",
      "- Check deployment logs for detailed error messages",
      "- Verify user permissions for deployment",
      "- Ensure org limits are not exceeded",
      "",
      "🎉 SUCCESS CRITERIA:",
      "✅ Both custom objects deployed successfully",
      "✅ All fields accessible and functional", 
      "✅ No errors in deployment logs",
      "✅ Application functionality verified"
    ]
  }
}

/**
 * Create manual deployment generator instance
 */
export function createManualDeploymentGenerator(
  tokenResponse: SalesforceTokenResponse,
  userInfo: SalesforceUserInfo
): SalesforceManualDeploymentGenerator {
  return new SalesforceManualDeploymentGenerator(tokenResponse, userInfo)
} 