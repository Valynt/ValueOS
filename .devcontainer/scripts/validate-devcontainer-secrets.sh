#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[secret-preflight] %s\n' "$*"
}

error() {
  printf '[secret-preflight][ERROR] %s\n' "$*" >&2
}

require_env() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    error "$name must be set to a non-empty value."
    exit 1
  fi
}

contains_placeholder() {
  local value="${1,,}"
  [[ "$value" == *"changeme"* ]] \
    || [[ "$value" == *"change-me"* ]] \
    || [[ "$value" == *"placeholder"* ]] \
    || [[ "$value" == *"example"* ]] \
    || [[ "$value" == *"your-"* ]] \
    || [[ "$value" == *"your_"* ]] \
    || [[ "$value" == *"replace-"* ]] \
    || [[ "$value" == *"replace_"* ]] \
    || [[ "$value" == *"local-dev"* ]] \
    || [[ "$value" == *"demo"* ]] \
    || [[ "$value" == *"test-"* ]]
}

validate_min_length() {
  local name="$1"
  local min_len="$2"
  local value="${!name}"
  if (( ${#value} < min_len )); then
    error "$name must be at least ${min_len} characters long."
    exit 1
  fi
}

validate_not_placeholder() {
  local name="$1"
  local value="${!name}"
  if contains_placeholder "$value"; then
    error "$name contains a placeholder/demo value. Generate a unique local secret before starting the stack."
    exit 1
  fi
}

validate_not_known_demo_jwt() {
  local name="$1"
  local value="${!name}"
  if [[ "$value" == *"eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24i"* ]] \
    || [[ "$value" == *"eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZS"* ]]; then
    error "$name is set to a known Supabase demo JWT. Replace it with a project-specific key."
    exit 1
  fi
}

validate_hex_key() {
  local name="$1"
  local value="${!name}"
  if [[ ! "$value" =~ ^[0-9a-fA-F]{64}$ ]]; then
    error "$name must be a 64-character hex string."
    exit 1
  fi
  if [[ "$value" =~ ^0+$ ]]; then
    error "$name must not be all zeros."
    exit 1
  fi
}

validate_optional_encryption_key() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    return 0
  fi
  validate_not_placeholder "$name"
  if [[ "$value" =~ ^[0-9a-fA-F]+$ ]]; then
    if (( ${#value} < 32 )); then
      error "$name must be at least 32 hex characters when provided."
      exit 1
    fi
    if [[ "$value" =~ ^0+$ ]]; then
      error "$name must not be all zeros."
      exit 1
    fi
    return 0
  fi
  validate_min_length "$name" 32
}

required_vars=(
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_ANON_KEY
  JWT_SECRET
  SECRET_KEY_BASE
  TCT_SECRET
  WEB_SCRAPER_ENCRYPTION_KEY
)

for name in "${required_vars[@]}"; do
  require_env "$name"
done

for name in SUPABASE_SERVICE_ROLE_KEY SUPABASE_ANON_KEY; do
  validate_not_placeholder "$name"
  validate_not_known_demo_jwt "$name"
  validate_min_length "$name" 32
done

for name in JWT_SECRET SECRET_KEY_BASE TCT_SECRET; do
  validate_not_placeholder "$name"
  validate_min_length "$name" 32
done

validate_hex_key WEB_SCRAPER_ENCRYPTION_KEY

for name in ENCRYPTION_KEY APP_ENCRYPTION_KEY CACHE_ENCRYPTION_KEY; do
  validate_optional_encryption_key "$name"
done

log 'Secret validation passed.'
