#!/bin/bash

# GitHub Code Optimizer Bot Installation Script

set -e

echo "🤖 GitHub Code Optimizer Bot Installation"
echo "========================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file template..."
    cat > .env << EOF
# GitHub Configuration
GITHUB_TOKEN=your_github_token_here
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# AI Configuration (OpenRouter)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Application Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Database Configuration (optional)
DATABASE_TYPE=memory
DATABASE_URL=

# Analysis Configuration
ANALYSIS_TIMEOUT=300000
MAX_CONCURRENCY=3
BATCH_SIZE=10
EOF
    echo "✅ Created .env file. Please edit it with your actual values."
    echo ""
    echo "🔑 Required tokens:"
    echo "   - GITHUB_TOKEN: GitHub Personal Access Token with repo permissions"
    echo "   - GITHUB_WEBHOOK_SECRET: Secret for webhook verification"
    echo "   - OPENROUTER_API_KEY: API key from OpenRouter"
    echo ""
    echo "Edit the .env file and run this script again."
    exit 0
fi

# Check if required environment variables are set
echo "🔍 Checking configuration..."

missing_vars=()
if [ -z "$GITHUB_TOKEN" ] && ! grep -q "GITHUB_TOKEN=your_" .env; then
    missing_vars+=("GITHUB_TOKEN")
fi
if [ -z "$OPENROUTER_API_KEY" ] && ! grep -q "OPENROUTER_API_KEY=your_" .env; then
    missing_vars+=("OPENROUTER_API_KEY")
fi

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables: ${missing_vars[*]}"
    echo "Please set them in the .env file or as environment variables."
    exit 1
fi

echo "✅ Configuration looks good."

# Create logs directory
mkdir -p logs

# Build and start the application
echo "🐳 Building and starting Docker containers..."
if command -v docker-compose &> /dev/null; then
    docker-compose up -d --build
else
    docker compose up -d --build
fi

echo "⏳ Waiting for the application to start..."
sleep 10

# Check if the application is healthy
if curl -f http://localhost:3000/health &> /dev/null; then
    echo "✅ Installation successful!"
    echo ""
    echo "🌐 Dashboard: http://localhost:3000"
    echo "📖 API Documentation: http://localhost:3000/api/docs"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Configure GitHub webhooks for your repositories"
    echo "   2. Add .github/code-optimizer.yml files to enable the bot"
    echo "   3. Monitor the dashboard for optimization suggestions"
else
    echo "❌ Application failed to start properly."
    echo "Check the logs with: docker-compose logs"
    exit 1
fi