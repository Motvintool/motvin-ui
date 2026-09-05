FROM node:20-alpine

WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy all static files
COPY . .

# Create runtime config and start server
# serve automatically uses serve.json for routing configuration
CMD sh -c 'echo "window.ENV = { API_URL: \"$API_URL\" };" > env-config.js && serve -c serve.json . -l 80'

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1
