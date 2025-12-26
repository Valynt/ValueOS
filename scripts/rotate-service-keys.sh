#!/bin/bash
# Helper script for rotating service keys in environment files

set -e

SHOW_HELP() {
    echo "Usage: $0 --env [FILE] --key [NAME] --value [VALUE]"
    echo ""
    echo "Options:"
    echo "  --env    Path to the .env file (e.g., .env.prod)"
    echo "  --key    The name of the environment variable to update"
    echo "  --value  The new value for the secret"
}

ENV_FILE=""
KEY_NAME=""
NEW_VALUE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --env) ENV_FILE="$2"; shift 2 ;;
        --key) KEY_NAME="$2"; shift 2 ;;
        --value) NEW_VALUE="$2"; shift 2 ;;
        *) SHOW_HELP; exit 1 ;;
    esac
done

if [[ -z "$ENV_FILE" || -z "$KEY_NAME" || -z "$NEW_VALUE" ]]; then
    SHOW_HELP
    exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: Environment file $ENV_FILE not found."
    exit 1
fi

# Create a backup
cp "$ENV_FILE" "${ENV_FILE}.bak"

# Update the key
# Use sed to replace the line OR append if it doesn't exist
if grep -q "^${KEY_NAME}=" "$ENV_FILE"; then
    sed -i "s|^${KEY_NAME}=.*|${KEY_NAME}=${NEW_VALUE}|" "$ENV_FILE"
    echo "Updated $KEY_NAME in $ENV_FILE"
else
    echo "${KEY_NAME}=${NEW_VALUE}" >> "$ENV_FILE"
    echo "Added $KEY_NAME to $ENV_FILE"
fi

echo "Backup created at ${ENV_FILE}.bak"
