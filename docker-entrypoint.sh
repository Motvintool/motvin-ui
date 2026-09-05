#!/bin/sh
set -e

# Default API URL if not provided
API_URL="${API_URL:-https://api.motvin.com/api/icons}"

echo "Injecting API_URL: $API_URL"

# Create env-config.js file that will be loaded by the app
cat > /usr/share/nginx/html/env-config.js <<EOF
// Auto-generated environment configuration
// DO NOT EDIT - This file is generated at container startup
window.ENV = {
  API_URL: '${API_URL}'
};
EOF

echo "Environment configuration injected successfully"

# Execute the main command (nginx)
exec "$@"
