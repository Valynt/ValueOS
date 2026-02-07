#!/bin/bash
###############################################################################
# Build Script with Retry and Circuit Breaker Logic
#
# Runs pnpm build with retry logic to handle flaky operations.
###############################################################################

set -euo pipefail

# Configurable parameters via environment variables
RETRY_COUNT=${RETRY_COUNT:-3}
RETRY_DELAY=${RETRY_DELAY:-15}
CIRCUIT_BREAKER_THRESHOLD=${CIRCUIT_BREAKER_THRESHOLD:-2}

# Retry a command with a maximum number of attempts and a delay between retries
retry_command() {
  local retries=$1
  local delay=$2
  local command="${@:3}"
  local count=0

  until $command; do
    exit_code=$?
    count=$((count+1))

    if [ $count -ge $retries ]; then
      echo "Command failed after $retries attempts."
      return $exit_code
    fi

    echo "Attempt $count/$retries failed. Retrying in $delay seconds..."
    sleep $delay
  done
}

# Circuit Breaker Logic
circuit_breaker() {
  local max_failures=$1
  local failure_count=0
  local command="${@:2}"

  while true; do
    # Execute the command
    if $command; then
      echo "Command succeeded."
      return 0
    else
      echo "Command failed."
      failure_count=$((failure_count + 1))

      # If failure count exceeds threshold, open the circuit
      if [ $failure_count -ge $max_failures ]; then
        echo "Circuit breaker triggered. Failing fast after $failure_count failures."
        return 1
      fi
    fi
  done
}

# Combined Retry and Circuit Breaker
retry_with_circuit_breaker() {
  local retries=$1
  local max_failures=$2
  local delay=$3
  local command="${@:4}"
  local failure_count=0
  local attempt=0

  # Setup cleanup on exit
  trap cleanup EXIT

  while [ $attempt -lt $retries ]; do
    if $command; then
      echo "Command succeeded."
      return 0
    else
      echo "Command failed. Attempt $((attempt + 1))/$retries"
      failure_count=$((failure_count + 1))

      if [ $failure_count -ge $max_failures ]; then
        echo "Circuit breaker triggered after $failure_count failures."
        graceful_shutdown
        return 1
      fi

      # Wait before retrying
      sleep $delay
      attempt=$((attempt + 1))
    fi
  done

  echo "Retries exhausted. Failing operation."
  graceful_shutdown
  return 1
}

# Graceful shutdown function
graceful_shutdown() {
  echo "🧹 Performing graceful shutdown..."

  # Clean up temporary build artifacts
  if [ -d "node_modules/.cache" ]; then
    echo "Cleaning build cache..."
    rm -rf node_modules/.cache 2>/dev/null || true
  fi

  # Clean up any dangling processes
  if command -v pkill >/dev/null 2>&1; then
    echo "Terminating any remaining build processes..."
    pkill -f "turbo run build" 2>/dev/null || true
    pkill -f "pnpm.*build" 2>/dev/null || true
  fi

  # Reset any partial build state
  if [ -d "dist" ]; then
    echo "Removing partial build outputs..."
    rm -rf dist 2>/dev/null || true
  fi

  echo "✅ Graceful shutdown complete."
}

# Cleanup function for trap
cleanup() {
  # Only perform cleanup if we failed
  if [ $? -ne 0 ]; then
    graceful_shutdown
  fi
}

# Main build function with retry
main() {
  local use_docker="${USE_DOCKER:-false}"

  if [[ "$use_docker" == "true" ]]; then
    echo "🔨 Running Docker-based hermetic build with retry logic..."
    echo "Configuration: RETRY_COUNT=$RETRY_COUNT, RETRY_DELAY=$RETRY_DELAY, CIRCUIT_BREAKER_THRESHOLD=$CIRCUIT_BREAKER_THRESHOLD"
    # Use retry_with_circuit_breaker for Docker build
    retry_with_circuit_breaker $RETRY_COUNT $CIRCUIT_BREAKER_THRESHOLD $RETRY_DELAY "pnpm run build:docker"
  else
    echo "🔨 Running local pnpm build with retry logic..."
    echo "Configuration: RETRY_COUNT=$RETRY_COUNT, RETRY_DELAY=$RETRY_DELAY, CIRCUIT_BREAKER_THRESHOLD=$CIRCUIT_BREAKER_THRESHOLD"
    # Use retry_with_circuit_breaker for pnpm build
    retry_with_circuit_breaker $RETRY_COUNT $CIRCUIT_BREAKER_THRESHOLD $RETRY_DELAY "pnpm build"
  fi
}

# Run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
