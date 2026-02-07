#!/usr/bin/env bash

# Secure notification script for deployment alerts
# Uses environment variables with proper masking

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}📢 $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Send notification with proper secret handling
send_notification() {
    local status="$1"
    local environment="$2"
    local image_digest="$3"
    local commit_sha="$4"
    local deployed_by="$5"
    local webhook_url="${SLACK_WEBHOOK_URL:-}"

    if [ -z "$webhook_url" ]; then
        log_info "No webhook URL configured, skipping notification"
        return 0
    fi

    # Create payload without exposing secrets in logs
    local payload
    case "$status" in
        "success")
            payload=$(cat <<EOF
{
    "text": "🚀 Production Deployment Successful",
    "blocks": [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Production Deployment Successful*\n\n*Environment:* $environment\n*Image:* \`${image_digest}\`\n*Commit:* \`${commit_sha}\`\n*Deployed by:* ${deployed_by}"
            }
        }
    ]
}
EOF
            )
            ;;
        "failure")
            payload=$(cat <<EOF
{
    "text": "⚠️ Production deployment failed and was rolled back",
    "blocks": [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Production Deployment Failed*\n\n*Environment:* $environment\n*Image:* \`${image_digest}\`\n*Commit:* \`${commit_sha}\`\n*Action:* Automatic rollback executed"
            }
        }
    ]
}
EOF
            )
            ;;
        *)
            log_error "Unknown status: $status"
            return 1
            ;;
    esac

    # Send notification with curl, masking the webhook URL
    log_info "Sending deployment notification..."

    # Use --silent to avoid exposing webhook URL in logs
    if curl --silent --fail --show-error \
        --request POST \
        --header 'Content-Type: application/json' \
        --data "$payload" \
        "$webhook_url" > /dev/null 2>&1; then
        log_success "Notification sent successfully"
        return 0
    else
        log_error "Failed to send notification"
        return 1
    fi
}

# Main execution
main() {
    local status="${1:-}"
    local environment="${2:-production}"
    local image_digest="${3:-}"
    local commit_sha="${4:-}"
    local deployed_by="${5:-}"

    if [ -z "$status" ]; then
        log_error "Status is required"
        echo "Usage: $0 <success|failure> [environment] [image_digest] [commit_sha] [deployed_by]"
        exit 1
    fi

    send_notification "$status" "$environment" "$image_digest" "$commit_sha" "$deployed_by"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
