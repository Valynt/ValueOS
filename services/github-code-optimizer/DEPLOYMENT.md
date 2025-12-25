# GitHub Code Optimizer Bot - Deployment Guide

This guide provides step-by-step instructions for deploying the GitHub Code Optimizer Bot to monitor and optimize code automatically.

## Prerequisites

- **Docker & Docker Compose**: Latest versions installed
- **GitHub Account**: With repository admin access
- **OpenRouter Account**: For AI analysis
- **Server/Domain**: For hosting the webhook endpoint

## Step 1: Prepare Your Server

### Option A: Local Development

```bash
# Navigate to the bot directory
cd services/github-code-optimizer

# Make the install script executable
chmod +x install.sh
```

### Option B: Cloud Server (AWS/GCP/Azure)

```bash
# Provision a server with:
# - Ubuntu 20.04+ or similar Linux distribution
# - At least 2GB RAM, 2 CPU cores
# - Docker and Docker Compose installed
# - Domain name pointing to the server

# SSH into your server
ssh user@your-server-ip

# Clone the repository
git clone <your-repo-url>
cd <your-repo>/services/github-code-optimizer
chmod +x install.sh
```

## Step 2: Obtain Required Tokens

### GitHub Personal Access Token

1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select scopes:
   - `repo` (Full control of private repositories)
   - `public_repo` (Access public repositories)
   - `read:org` (Read org membership - if using org repos)
4. Copy the token (save it securely)

### OpenRouter API Key

1. Go to [OpenRouter](https://openrouter.ai/)
2. Sign up/Sign in
3. Navigate to API Keys section
4. Generate a new API key
5. Copy the key

### Optional: Webhook Secret

Generate a secure webhook secret:

```bash
openssl rand -hex 32
```

## Step 3: Configure Environment

The installation script will create a `.env` file. Edit it with your tokens:

```bash
./install.sh
# Follow the prompts and edit the created .env file
```

Or create it manually:

```env
# GitHub Configuration
GITHUB_TOKEN=ghp_your_github_token_here
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# AI Configuration (OpenRouter)
OPENROUTER_API_KEY=sk-or-v1_your_openrouter_key_here

# Application Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Optional: Database Configuration
DATABASE_TYPE=memory
```

## Step 4: Deploy the Bot

### Quick Deployment

```bash
./install.sh
```

This script will:

- ✅ Check system requirements
- ✅ Create `.env` file if missing
- ✅ Build Docker images
- ✅ Start all services
- ✅ Verify health checks

### Manual Deployment

```bash
# Build and start
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f github-code-optimizer
```

## Step 5: Verify Deployment

### Health Check

```bash
curl http://localhost:3000/health
# Should return: {"status":"healthy","timestamp":"..."}
```

### Check Logs

```bash
docker-compose logs github-code-optimizer
```

### Test Webhook Endpoint

```bash
curl -X POST http://localhost:3000/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -d '{"zen":"Keep it logically awesome."}'
```

## Step 6: Configure GitHub Integration

### Option A: GitHub App (Recommended)

1. **Create GitHub App**:
   - Go to [GitHub Settings → Developer settings → GitHub Apps](https://github.com/settings/apps)
   - Click "New GitHub App"
   - Fill details:
     - **Name**: "Code Optimizer Bot"
     - **Homepage URL**: `https://your-domain.com`
     - **Webhook URL**: `https://your-domain.com/webhooks/github`
     - **Webhook secret**: Your `GITHUB_WEBHOOK_SECRET`

2. **Permissions**:
   - Repository permissions:
     - Contents: Read & Write
     - Pull requests: Read & Write
     - Metadata: Read

3. **Subscribe to events**:
   - Push
   - Pull request

4. **Install the App**:
   - Install on your account or organization
   - Select repositories to monitor

### Option B: Webhooks Only

For each repository:

1. Go to Repository Settings → Webhooks
2. Click "Add webhook"
3. Configure:
   - **Payload URL**: `https://your-domain.com/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: Your `GITHUB_WEBHOOK_SECRET`
   - **Events**: Push, Pull requests

## Step 7: Configure Repository Settings

Add configuration file to each repository you want to optimize:

**.github/code-optimizer.yml**

```yaml
enabled: true
thresholds:
  performanceGain: 0.1 # 10% minimum improvement
  maxFiles: 100
  maxFileSize: 1048576 # 1MB
languages:
  - javascript
  - typescript
  - python
blacklist:
  - "node_modules/**"
  - "dist/**"
  - "*.min.js"
ai:
  model: "openai/gpt-4o"
  maxTokens: 4096
```

## Step 8: Test the Bot

### Trigger Analysis

1. **Push code** to a configured repository:

   ```bash
   git add .
   git commit -m "Test commit for bot analysis"
   git push origin main
   ```

2. **Check logs** for analysis activity:

   ```bash
   docker-compose logs -f github-code-optimizer
   ```

3. **Monitor dashboard** at `http://localhost:3000`

### Expected Behavior

- Bot receives webhook on push
- Downloads and analyzes repository code
- Identifies optimization opportunities
- Creates pull request with improvements (if any found)

## Step 9: Production Deployment

### SSL Certificate (Required for GitHub)

GitHub requires HTTPS for webhooks. Set up SSL:

#### Using Let's Encrypt (Free)

```bash
# Install certbot
sudo apt update
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Configure automatic renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Using Reverse Proxy (Nginx/Caddy)

**nginx.conf**:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Security Hardening

```bash
# Run container as non-root
# Limit resource usage in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '1.0'
```

### Monitoring & Alerts

```bash
# Set up log rotation
# Configure health check monitoring
# Add alerting for failed analyses
```

## Step 10: Maintenance

### Updates

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Backup

```bash
# Backup configuration
cp .env .env.backup

# Backup logs
docker-compose logs > logs/backup-$(date +%Y%m%d).log
```

### Troubleshooting

#### Common Issues

1. **Webhook not triggering**:

   ```bash
   # Check webhook delivery in GitHub
   # Verify URL and secret
   # Check SSL certificate
   ```

2. **Analysis fails**:

   ```bash
   docker-compose logs github-code-optimizer
   # Check token permissions
   # Verify repository access
   ```

3. **AI responses failing**:
   ```bash
   # Check OpenRouter API key
   # Verify model availability
   # Check rate limits
   ```

## Support

- Check logs: `docker-compose logs -f`
- Health endpoint: `GET /health`
- Dashboard: `http://localhost:3000`
- Documentation: See README.md

## Quick Reference

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# Update
git pull && docker-compose up -d --build

# Logs
docker-compose logs -f github-code-optimizer

# Health check
curl http://localhost:3000/health
```

The bot is now deployed and will automatically monitor your repositories for optimization opportunities!
