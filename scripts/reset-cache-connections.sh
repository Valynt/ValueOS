#!/bin/bash

# Reset Redis Connection Cache
# This script resets Redis connection caches and clears relevant data

set -e

echo "🔄 Resetting Redis Connection Cache..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Redis is running
check_redis_health() {
    print_status "Checking Redis health..."

    if command -v redis-cli &> /dev/null; then
        if redis-cli ping &> /dev/null; then
            print_status "✅ Redis is healthy"
            return 0
        else
            print_warning "⚠️  Redis is not responding to ping"
            return 1
        fi
    elif command -v docker &> /dev/null && docker ps | grep -q redis; then
        if docker exec $(docker ps -q -f name=redis) redis-cli ping &> /dev/null; then
            print_status "✅ Redis container is healthy"
            return 0
        else
            print_warning "⚠️  Redis container is not responding"
            return 1
        fi
    else
        print_warning "⚠️  Cannot check Redis health (redis-cli not available)"
        return 1
    fi
}

# Reset Redis connections
reset_redis_connections() {
    print_status "Resetting Redis connections..."

    # Method 1: If using Node.js, clear require cache for Redis modules
    if command -v node &> /dev/null; then
        print_status "Clearing Node.js Redis module cache..."

        # Create a simple Node.js script to reset connections
        cat > /tmp/reset-redis-connections.js << 'EOF'
const { createClient } = require('redis');
const path = require('path');

async function resetConnections() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
        console.log('Connecting to Redis at:', redisUrl);
        const client = createClient({ url: redisUrl });

        client.on('error', (err) => {
            console.error('Redis client error:', err.message);
        });

        await client.connect();

        // Test connection
        const pingResult = await client.ping();
        console.log('Redis ping result:', pingResult);

        // Clear some common cache patterns
        const patterns = ['cache:*', 'llm:cache:*', 'agent:*'];

        for (const pattern of patterns) {
            try {
                const keys = await client.keys(pattern);
                if (keys.length > 0) {
                    const deleted = await client.del(keys);
                    console.log(`Cleared ${deleted} keys matching ${pattern}`);
                }
            } catch (err) {
                console.warn(`Failed to clear pattern ${pattern}:`, err.message);
            }
        }

        await client.disconnect();
        console.log('✅ Redis connection reset completed');

    } catch (error) {
        console.error('❌ Redis connection reset failed:', error.message);
        process.exit(1);
    }
}

resetConnections();
EOF

        # Run the reset script
        if [ -f "package.json" ]; then
            # If we're in a Node.js project, try to use local dependencies
            if [ -d "node_modules" ]; then
                node /tmp/reset-redis-connections.js
            else
                print_warning "Node.js modules not found, skipping Node.js cache reset"
            fi
        else
            print_warning "Not in a Node.js project, skipping Node.js cache reset"
        fi
    fi

    # Clean up temp file
    rm -f /tmp/reset-redis-connections.js
}

# Clear application-level caches
clear_app_caches() {
    print_status "Clearing application caches..."

    # Clear Node.js require cache for cache modules
    if [ -d "packages/backend/src/services/cache" ]; then
        print_status "Found cache modules in packages/backend/src/services/cache"
    fi

    if [ -d "packages/shared/src/lib/cache" ]; then
        print_status "Found cache modules in packages/shared/src/lib/cache"
    fi

    # Clear any local cache directories
    if [ -d ".cache" ]; then
        print_status "Clearing .cache directory..."
        rm -rf .cache/*
    fi

    if [ -d "node_modules/.cache" ]; then
        print_status "Clearing node_modules/.cache directory..."
        rm -rf node_modules/.cache/*
    fi
}

# Restart Redis if in Docker
restart_redis_container() {
    if command -v docker &> /dev/null; then
        REDIS_CONTAINER=$(docker ps -q -f name=redis)
        if [ -n "$REDIS_CONTAINER" ]; then
            print_status "Restarting Redis container..."
            docker restart "$REDIS_CONTAINER"

            # Wait for Redis to be ready
            print_status "Waiting for Redis to be ready..."
            for i in {1..30}; do
                if docker exec "$REDIS_CONTAINER" redis-cli ping &> /dev/null; then
                    print_status "✅ Redis container is ready"
                    return 0
                fi
                sleep 1
            done

            print_error "Redis container failed to become ready"
            return 1
        fi
    fi
}

# Main execution
main() {
    echo "=========================================="
    echo "    Redis Connection Cache Reset Tool"
    echo "=========================================="
    echo ""

    # Parse arguments
    FORCE=false
    RESTART=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                FORCE=true
                shift
                ;;
            --restart)
                RESTART=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--force] [--restart]"
                echo ""
                echo "Options:"
                echo "  --force    Force reset even if Redis appears healthy"
                echo "  --restart  Restart Redis container (if using Docker)"
                echo "  --help     Show this help message"
                echo ""
                echo "This script will:"
                echo "  1. Check Redis health"
                echo "  2. Reset Redis connections"
                echo "  3. Clear application caches"
                echo "  4. Optionally restart Redis container"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Check Redis health
    if ! check_redis_health; then
        if [ "$FORCE" = false ]; then
            print_error "Redis is not healthy. Use --force to reset anyway."
            exit 1
        fi
        print_warning "Proceeding with reset despite Redis health issues"
    fi

    echo ""

    # Perform reset operations
    reset_redis_connections
    clear_app_caches

    if [ "$RESTART" = true ]; then
        restart_redis_container
    fi

    echo ""
    print_status "🎉 Redis connection cache reset completed!"
    echo ""
    echo "Next steps:"
    echo "  - Restart your application services to pick up new connections"
    echo "  - Monitor application logs for any connection issues"
    echo "  - Check application performance after cache reset"
}

# Run main function
main "$@"
