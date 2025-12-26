#!/bin/sh
# ValueCanvas Docker Entrypoint script

set -e

echo "🚀 Starting ValueCanvas Production..."

# Run database migrations (optional, can be done via CI/CD)
# if [ "$RUN_MIGRATIONS" = "true" ]; then
#   echo "🔄 Running migrations..."
#   npm run db:push
# fi

# Start the application
echo "📡 Starting backend server..."
exec npm run backend:start
