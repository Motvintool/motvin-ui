# Docker Setup for Motvin UI

This document explains how to run the Motvin UI using Docker with environment variable configuration.

## Quick Start

### Option 1: Docker Compose (Recommended)

Runs both UI and backend together:

```bash
# 1. Copy .env.example to .env and configure
cp .env.example .env

# 2. Build and run both services
docker-compose up --build

# 3. Access the UI
# UI: http://localhost:8080
# Backend API: http://localhost:3000
```

### Option 2: UI Only (Backend running separately)

```bash
# 1. Build the Docker image
docker build -t motvin-ui .

# 2. Run with custom API URL
docker run -d \
  --name motvin-ui \
  -p 8080:80 \
  -e API_URL=http://localhost:3000/api/icons \
  motvin-ui

# 3. Access at http://localhost:8080
```

## Environment Configuration

### Available Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `API_URL` | Backend API base URL | `https://api.motvin.com/api/icons` | `http://localhost:3000/api/icons` |

### Configuration Methods

#### Method 1: .env File (Docker Compose)

Create a `.env` file in the `motvin-ui/` directory:

```bash
# .env
API_URL=http://localhost:3000/api/icons
```

Then run:
```bash
docker-compose up
```

#### Method 2: Environment Variable (Docker Run)

```bash
docker run -d \
  -p 8080:80 \
  -e API_URL=https://api.motvin.com/api/icons \
  motvin-ui
```

#### Method 3: Environment File (Docker Run)

```bash
docker run -d \
  -p 8080:80 \
  --env-file .env \
  motvin-ui
```

## Production Deployment

For production with separate UI and API domains:

```bash
# Build for production
docker build -t motvin-ui:prod .

# Run with production API URL
docker run -d \
  --name motvin-ui-prod \
  -p 80:80 \
  -e API_URL=https://api.motvin.com/api/icons \
  --restart unless-stopped \
  motvin-ui:prod
```

## Architecture

```
┌─────────────────────────────────────────┐
│  Browser (motvin.com)                   │
│  ├─ HTML/CSS/JS files                   │
│  └─ env-config.js (injected at runtime) │
└────────────┬────────────────────────────┘
             │
             │ HTTP Requests
             ▼
┌─────────────────────────────────────────┐
│  Backend API (api.motvin.com)           │
│  ├─ NestJS API Server                   │
│  ├─ Icon Data & Search                  │
│  └─ SVG Content                         │
└─────────────────────────────────────────┘
```

## How Environment Injection Works

1. **Build Time**: Dockerfile copies all static files
2. **Runtime**: `docker-entrypoint.sh` generates `env-config.js` with actual env values
3. **Browser Load**: `icons.html` loads `env-config.js` before `api-client.js`
4. **API Client**: Reads `window.ENV.API_URL` to determine backend URL

### Files Involved

- **`docker-entrypoint.sh`**: Generates `env-config.js` at container startup
- **`env-config.js`**: Contains `window.ENV` object (replaced at runtime)
- **`JS/api-client.js`**: Reads `window.ENV.API_URL` to configure API calls
- **`icons.html`**: Loads `env-config.js` before API client scripts

## Development vs Production

### Local Development
```bash
# No Docker needed - just open HTML files
# API URL defaults to http://localhost:3000/api/icons
open icons.html
```

### Docker Development
```bash
# Run both UI and backend
docker-compose up

# UI: http://localhost:8080
# Backend: http://localhost:3000
```

### Production
```bash
# UI domain: motvin.com
# API domain: api.motvin.com

docker run -d \
  -p 80:80 \
  -e API_URL=https://api.motvin.com/api/icons \
  motvin-ui:prod
```

## Troubleshooting

### Check environment injection
```bash
# Exec into running container
docker exec -it motvin-ui sh

# Check generated env-config.js
cat /usr/share/nginx/html/env-config.js
```

### Check nginx logs
```bash
docker logs motvin-ui
```

### Verify API URL in browser
Open browser console:
```javascript
console.log(window.ENV.API_URL);
```

### CORS Issues
If you see CORS errors, make sure the backend allows requests from your UI domain:
```typescript
// In backend: motvin-backend/src/main.ts
app.enableCors({
  origin: ['http://localhost:8080', 'https://motvin.com'],
  credentials: true,
});
```

## Docker Commands Reference

```bash
# Build image
docker build -t motvin-ui .

# Run container
docker run -d --name motvin-ui -p 8080:80 motvin-ui

# View logs
docker logs motvin-ui

# Stop container
docker stop motvin-ui

# Remove container
docker rm motvin-ui

# Remove image
docker rmi motvin-ui

# Docker Compose
docker-compose up          # Start services
docker-compose up -d       # Start in background
docker-compose down        # Stop and remove
docker-compose logs -f     # Follow logs
docker-compose ps          # List services
```

## Health Checks

The UI container includes health checks:

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' motvin-ui

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' motvin-ui
```

## Updates and Rebuilds

When you update the UI code:

```bash
# Rebuild and restart
docker-compose up --build

# Or for UI only
docker build -t motvin-ui . && \
docker stop motvin-ui && \
docker rm motvin-ui && \
docker run -d --name motvin-ui -p 8080:80 motvin-ui
```
