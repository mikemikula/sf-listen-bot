#!/bin/bash

echo "🚀 Salesforce SFDX Deployment Script"
echo "===================================="

# Check if SFDX is installed
if ! command -v sfdx &> /dev/null; then
    echo "❌ SFDX CLI is not installed. Please install it first:"
    echo "   npm install -g sfdx-cli"
    exit 1
fi

# Your Salesforce instance URL and username
INSTANCE_URL="https://orgfarm-e962a22fbd-dev-ed.develop.my.salesforce.com"
USERNAME="mikemikula@gmail.com"

echo ""
echo "📋 Deployment Details:"
echo "   Instance: $INSTANCE_URL"
echo "   Username: $USERNAME"
echo ""

# Option 1: If you have an active SFDX auth
echo "Option 1: Using existing SFDX authentication"
echo "---------------------------------------------"
echo "If you've already authenticated with SFDX, run:"
echo "  sfdx force:source:deploy -p force-app -u myorg"
echo ""

# Option 2: Authenticate and deploy
echo "Option 2: Fresh authentication and deployment"
echo "---------------------------------------------"
echo "1. Authenticate (this will open a browser):"
echo "   sfdx force:auth:web:login -a sf-listen-bot -r $INSTANCE_URL"
echo ""
echo "2. Deploy the metadata:"
echo "   sfdx force:source:deploy -p force-app -u sf-listen-bot"
echo ""

# Option 3: Use access token from the app
echo "Option 3: Use access token from the app (if available)"
echo "------------------------------------------------------"
echo "If you have the access token from the app, you can use:"
echo "   sfdx force:auth:accesstoken:store -r $INSTANCE_URL -a sf-listen-bot"
echo "   (You'll be prompted for the access token)"
echo ""
echo "Then deploy with:"
echo "   sfdx force:source:deploy -p force-app -u sf-listen-bot"
echo ""

# Ask user which option to proceed with
read -p "Which option would you like to use? (1/2/3): " option

case $option in
    1)
        echo "Deploying with existing auth..."
        sfdx force:source:deploy -p force-app -u myorg
        ;;
    2)
        echo "Opening browser for authentication..."
        sfdx force:auth:web:login -a sf-listen-bot -r $INSTANCE_URL
        if [ $? -eq 0 ]; then
            echo "Authentication successful! Deploying..."
            sfdx force:source:deploy -p force-app -u sf-listen-bot
        else
            echo "❌ Authentication failed"
            exit 1
        fi
        ;;
    3)
        echo "Please enter your access token:"
        read -s ACCESS_TOKEN
        echo $ACCESS_TOKEN | sfdx force:auth:accesstoken:store -r $INSTANCE_URL -a sf-listen-bot
        if [ $? -eq 0 ]; then
            echo "Token stored successfully! Deploying..."
            sfdx force:source:deploy -p force-app -u sf-listen-bot
        else
            echo "❌ Failed to store access token"
            exit 1
        fi
        ;;
    *)
        echo "Invalid option selected"
        exit 1
        ;;
esac

echo ""
echo "✅ Deployment complete!"
echo ""
echo "To verify in Salesforce:"
echo "1. Go to Setup > Object Manager"
echo "2. Look for 'Slack Document' and 'Slack FAQ'"
echo "3. Check that all fields are created" 