const fs = require('fs');
const path = require('path');

// Document fields
const documentFields = [
  {
    fullName: 'Document_ID__c',
    label: 'Document ID',
    type: 'Text',
    length: 255,
    unique: true,
    externalId: true,
    required: true,
    description: 'Unique identifier for the document from Slack'
  },
  {
    fullName: 'Channel_ID__c',
    label: 'Channel ID',
    type: 'Text',
    length: 255,
    required: true,
    description: 'Slack channel identifier where the document originated'
  },
  {
    fullName: 'Channel_Name__c',
    label: 'Channel Name',
    type: 'Text',
    length: 255,
    required: true,
    description: 'Human-readable name of the Slack channel'
  },
  {
    fullName: 'Thread_ID__c',
    label: 'Thread ID',
    type: 'Text',
    length: 255,
    description: 'Slack thread identifier if document is from a thread'
  },
  {
    fullName: 'Content__c',
    label: 'Content',
    type: 'LongTextArea',
    length: 32768,
    visibleLines: 10,
    description: 'Full text content of the document'
  },
  {
    fullName: 'Author__c',
    label: 'Author',
    type: 'Text',
    length: 255,
    description: 'Author of the document from Slack'
  },
  {
    fullName: 'Message_Count__c',
    label: 'Message Count',
    type: 'Number',
    precision: 10,
    scale: 0,
    description: 'Number of messages in the document'
  },
  {
    fullName: 'Timestamp__c',
    label: 'Timestamp',
    type: 'DateTime',
    required: true,
    description: 'When the document was created in Slack'
  },
  {
    fullName: 'Status__c',
    label: 'Status',
    type: 'Picklist',
    description: 'Processing status of the document',
    valueSet: {
      restricted: true,
      valueSetDefinition: {
        value: [
          { fullName: 'Draft', default: true, label: 'Draft' },
          { fullName: 'Processed', default: false, label: 'Processed' },
          { fullName: 'Published', default: false, label: 'Published' },
          { fullName: 'Archived', default: false, label: 'Archived' }
        ]
      }
    }
  },
  {
    fullName: 'Processing_Status__c',
    label: 'Processing Status',
    type: 'Picklist',
    description: 'Current processing state',
    valueSet: {
      restricted: true,
      valueSetDefinition: {
        value: [
          { fullName: 'Pending', default: true, label: 'Pending' },
          { fullName: 'Processing', default: false, label: 'Processing' },
          { fullName: 'Complete', default: false, label: 'Complete' },
          { fullName: 'Error', default: false, label: 'Error' }
        ]
      }
    }
  },
  {
    fullName: 'Document_Type__c',
    label: 'Document Type',
    type: 'Picklist',
    description: 'Type of document from Slack',
    valueSet: {
      restricted: true,
      valueSetDefinition: {
        value: [
          { fullName: 'Thread', default: false, label: 'Thread' },
          { fullName: 'Channel', default: true, label: 'Channel' },
          { fullName: 'Direct', default: false, label: 'Direct Message' }
        ]
      }
    }
  },
  {
    fullName: 'Tags__c',
    label: 'Tags',
    type: 'Text',
    length: 255,
    description: 'Comma-separated tags for categorization'
  }
];

// FAQ fields
const faqFields = [
  {
    fullName: 'Question__c',
    label: 'Question',
    type: 'LongTextArea',
    length: 32768,
    visibleLines: 3,
    description: 'The FAQ question'
  },
  {
    fullName: 'Answer__c',
    label: 'Answer',
    type: 'LongTextArea',
    length: 32768,
    visibleLines: 8,
    description: 'The FAQ answer'
  },
  {
    fullName: 'Document__c',
    label: 'Source Document',
    type: 'Lookup',
    referenceTo: 'Slack_Document__c',
    relationshipLabel: 'FAQs',
    relationshipName: 'FAQs',
    description: 'The source document this FAQ was generated from'
  },
  {
    fullName: 'Channel_ID__c',
    label: 'Channel ID',
    type: 'Text',
    length: 255,
    description: 'Slack channel identifier'
  },
  {
    fullName: 'Channel_Name__c',
    label: 'Channel Name',
    type: 'Text',
    length: 255,
    description: 'Human-readable name of the Slack channel'
  },
  {
    fullName: 'Status__c',
    label: 'Status',
    type: 'Picklist',
    description: 'FAQ approval status',
    valueSet: {
      restricted: true,
      valueSetDefinition: {
        value: [
          { fullName: 'Draft', default: true, label: 'Draft' },
          { fullName: 'Review', default: false, label: 'Under Review' },
          { fullName: 'Approved', default: false, label: 'Approved' },
          { fullName: 'Published', default: false, label: 'Published' },
          { fullName: 'Archived', default: false, label: 'Archived' }
        ]
      }
    }
  },
  {
    fullName: 'Confidence_Score__c',
    label: 'Confidence Score',
    type: 'Number',
    precision: 5,
    scale: 2,
    description: 'AI confidence score for the FAQ (0-100)'
  },
  {
    fullName: 'Source_Messages__c',
    label: 'Source Messages',
    type: 'LongTextArea',
    length: 32768,
    visibleLines: 5,
    description: 'Original Slack messages used to generate this FAQ'
  },
  {
    fullName: 'Category__c',
    label: 'Category',
    type: 'Text',
    length: 255,
    description: 'FAQ category for organization'
  }
];

// Function to generate field XML
function generateFieldXML(field) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${field.fullName}</fullName>
    <label>${field.label}</label>
    <type>${field.type}</type>`;

  // Add type-specific properties
  if (field.length) xml += `\n    <length>${field.length}</length>`;
  if (field.precision !== undefined) xml += `\n    <precision>${field.precision}</precision>`;
  if (field.scale !== undefined) xml += `\n    <scale>${field.scale}</scale>`;
  if (field.visibleLines) xml += `\n    <visibleLines>${field.visibleLines}</visibleLines>`;
  
  // Add field properties
  if (field.required) xml += `\n    <required>${field.required}</required>`;
  if (field.unique) xml += `\n    <unique>${field.unique}</unique>`;
  if (field.externalId) xml += `\n    <externalId>${field.externalId}</externalId>`;
  if (field.description) xml += `\n    <description>${field.description}</description>`;
  if (field.defaultValue) xml += `\n    <defaultValue>${field.defaultValue}</defaultValue>`;

  // Add relationship properties
  if (field.referenceTo) {
    xml += `\n    <referenceTo>${field.referenceTo}</referenceTo>`;
    if (field.relationshipLabel) xml += `\n    <relationshipLabel>${field.relationshipLabel}</relationshipLabel>`;
    if (field.relationshipName) xml += `\n    <relationshipName>${field.relationshipName}</relationshipName>`;
  }

  // Add picklist values
  if (field.valueSet) {
    xml += `\n    <valueSet>
        <restricted>${field.valueSet.restricted}</restricted>
        <valueSetDefinition>`;
    
    for (const value of field.valueSet.valueSetDefinition.value) {
      xml += `\n            <value>
                <fullName>${value.fullName}</fullName>
                <default>${value.default}</default>
                <label>${value.label}</label>
            </value>`;
    }
    
    xml += `\n        </valueSetDefinition>
    </valueSet>`;
  }

  xml += '\n</CustomField>';
  return xml;
}

// Create field files for Slack_Document__c
console.log('Creating Slack_Document__c fields...');
documentFields.forEach(field => {
  const xml = generateFieldXML(field);
  const filePath = path.join('force-app/main/default/objects/Slack_Document__c/fields', `${field.fullName}.field-meta.xml`);
  fs.writeFileSync(filePath, xml);
  console.log(`Created: ${filePath}`);
});

// Create field files for Slack_FAQ__c
console.log('\nCreating Slack_FAQ__c fields...');
faqFields.forEach(field => {
  const xml = generateFieldXML(field);
  const filePath = path.join('force-app/main/default/objects/Slack_FAQ__c/fields', `${field.fullName}.field-meta.xml`);
  fs.writeFileSync(filePath, xml);
  console.log(`Created: ${filePath}`);
});

console.log('\nAll field metadata files created successfully!');
console.log('\nTo deploy with SFDX:');
console.log('1. Make sure you have SFDX CLI installed');
console.log('2. Authenticate to your org: sfdx force:auth:web:login -a myorg');
console.log('3. Deploy the metadata: sfdx force:source:deploy -p force-app -u myorg'); 