#!/bin/bash

set -e

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: ./deploy.sh [dev|stage|prod]"
    exit 1
fi

case $ENVIRONMENT in
    dev)
        echo "🚀 Starting development environment..."
        docker-compose -f infra/infra/infra/docker/dev/docker-compose.yml up -d
        ;;
    stage)
        echo "🚀 Deploying to staging..."
        docker-compose -f infra/infra/infra/docker/staging/docker-compose.yml down
        docker-compose -f infra/infra/infra/docker/staging/docker-compose.yml up -d --build
        ;;
    prod)
        echo "🚀 Deploying to production..."
        # Backup database first
        ./scripts/backup-database.sh
        # Deploy with zero-downtime
        docker-compose -f infra/infra/infra/docker/prod/docker-compose.yml up -d --build --no-deps app
        ;;
    *)
        echo "Invalid environment: $ENVIRONMENT"
        exit 1
        ;;

esac

echo "✅ Deployment complete!"
