#!/bin/bash
# Script to create a new VIBE project via the API

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

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <project-name> <repository-url>"
    echo ""
    echo "Example:"
    echo "  $0 my-app https://github.com/myorg/my-app"
    echo ""
    echo "Environment variables:"
    echo "  VIBE_API_URL - API URL (default: http://localhost:3001)"
    exit 1
fi

PROJECT_NAME="$1"
REPO_URL="$2"

echo "Creating VIBE project..."
echo "  Name: $PROJECT_NAME"
echo "  Repository: $REPO_URL"
echo "  API URL: $API_URL"
echo ""

# Create project via API
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/projects" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$PROJECT_NAME\",\"repository_url\":\"$REPO_URL\"}")

# Extract body and status code
HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" -eq 201 ]; then
    print_success "Project created successfully!"
    echo ""
    echo "Project details:"
    echo "$HTTP_BODY" | jq '.'
    echo ""
    print_success "You can now use this project to create tasks"
    echo ""
    echo "Example:"
    PROJECT_ID=$(echo "$HTTP_BODY" | jq -r '.project_id')
    echo "  curl -X POST $API_URL/jobs \\"
    echo "    -H \"Content-Type: application/json\" \\"
    echo "    -d '{"
    echo "      \"prompt\": \"Add error handling to API endpoints\","
    echo "      \"project_id\": \"$PROJECT_ID\","
    echo "      \"base_branch\": \"main\""
    echo "    }'"
    exit 0
else
    print_error "Failed to create project (HTTP $HTTP_CODE)"
    echo ""
    echo "Response:"
    echo "$HTTP_BODY" | jq '.'
    exit 1
fi
