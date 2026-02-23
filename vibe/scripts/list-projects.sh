#!/bin/bash
# Script to list all VIBE projects

set -e

# Configuration
API_URL="${VIBE_API_URL:-http://localhost:3001}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

echo "Fetching VIBE projects..."
echo "  API URL: $API_URL"
echo ""

# Fetch projects via API
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/projects")

# Extract body and status code
HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" -eq 200 ]; then
    # Check if any projects exist
    PROJECT_COUNT=$(echo "$HTTP_BODY" | jq '. | length')
    
    if [ "$PROJECT_COUNT" -eq 0 ]; then
        echo "No projects found."
        echo ""
        echo "Create a project using:"
        echo "  ./scripts/create-project.sh <project-name> <repository-url>"
        exit 0
    fi
    
    print_success "Found $PROJECT_COUNT project(s)"
    echo ""
    echo "Projects:"
    echo "$HTTP_BODY" | jq -r '.[] | "  • \(.name) (\(.project_id))\n    Repository: \(.repository_url)\n    Local path: \(.local_path)\n    Last synced: \(if .last_synced then (.last_synced / 1000 | strftime("%Y-%m-%d %H:%M:%S")) else "Never" end)\n"'
    exit 0
else
    print_error "Failed to fetch projects (HTTP $HTTP_CODE)"
    echo ""
    echo "Response:"
    echo "$HTTP_BODY" | jq '.'
    exit 1
fi
