#!/bin/bash
###############################################################################
# Test Script for Retry and Circuit Breaker Logic
#
# Tests various failure scenarios to ensure resilience mechanisms work correctly.
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the build script to use its functions
source "$SCRIPT_DIR/build-with-retry.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test helper functions
test_start() {
  echo "🧪 Running test: $1"
  TESTS_RUN=$((TESTS_RUN + 1))
}

test_pass() {
  echo "✅ PASSED: $1"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

test_fail() {
  echo "❌ FAILED: $1"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

# Mock commands for testing
failing_command() {
  echo "Command executed (will fail)"
  return 1
}

succeeding_command() {
  echo "Command executed (will succeed)"
  return 0
}

intermittent_command() {
  # Succeed on 3rd attempt
  if [ ! -f /tmp/test_counter ]; then
    echo 1 > /tmp/test_counter
    echo "Command failed (attempt 1)"
    return 1
  fi

  local count=$(cat /tmp/test_counter)
  count=$((count + 1))
  echo $count > /tmp/test_counter

  if [ $count -lt 3 ]; then
    echo "Command failed (attempt $count)"
    return 1
  else
    echo "Command succeeded (attempt $count)"
    rm -f /tmp/test_counter
    return 0
  fi
}

# Test cases
test_retry_success() {
  test_start "Retry logic with successful command"

  if retry_command 3 1 succeeding_command >/dev/null 2>&1; then
    test_pass "Retry logic with successful command"
  else
    test_fail "Retry logic with successful command"
  fi
}

test_retry_failure() {
  test_start "Retry logic with always failing command"

  if retry_command 2 1 failing_command >/dev/null 2>&1; then
    test_fail "Retry logic should fail with always failing command"
  else
    test_pass "Retry logic correctly failed with always failing command"
  fi
}

test_retry_intermittent() {
  test_start "Retry logic with intermittent failure"

  rm -f /tmp/test_counter
  if retry_command 5 1 intermittent_command >/dev/null 2>&1; then
    test_pass "Retry logic handled intermittent failure"
  else
    test_fail "Retry logic failed to handle intermittent failure"
  fi
}

test_circuit_breaker_immediate_failure() {
  test_start "Circuit breaker with immediate failures"

  if retry_with_circuit_breaker 3 1 1 failing_command >/dev/null 2>&1; then
    test_fail "Circuit breaker should trigger with immediate failures"
  else
    test_pass "Circuit breaker correctly triggered with immediate failures"
  fi
}

test_circuit_breaker_recovery() {
  test_start "Circuit breaker with recovery"

  rm -f /tmp/test_counter
  if retry_with_circuit_breaker 5 3 1 intermittent_command >/dev/null 2>&1; then
    test_pass "Circuit breaker allowed recovery"
  else
    test_fail "Circuit breaker prevented recovery"
  fi
}

test_environment_variables() {
  test_start "Environment variable configuration"

  local old_retry_count=${RETRY_COUNT:-3}
  local old_circuit_threshold=${CIRCUIT_BREAKER_THRESHOLD:-2}

  export RETRY_COUNT=1
  export CIRCUIT_BREAKER_THRESHOLD=1

  # Reload the script with new variables
  source "$SCRIPT_DIR/build-with-retry.sh" >/dev/null 2>&1

  if [ "$RETRY_COUNT" = "1" ] && [ "$CIRCUIT_BREAKER_THRESHOLD" = "1" ]; then
    test_pass "Environment variables correctly applied"
  else
    test_fail "Environment variables not applied correctly"
  fi

  # Restore original values
  export RETRY_COUNT=$old_retry_count
  export CIRCUIT_BREAKER_THRESHOLD=$old_circuit_threshold
}

# Run all tests
main() {
  echo "🚀 Starting Retry and Circuit Breaker Tests"
  echo "==========================================="

  test_retry_success
  test_retry_failure
  test_retry_intermittent
  test_circuit_breaker_immediate_failure
  test_circuit_breaker_recovery
  test_environment_variables

  echo "==========================================="
  echo "📊 Test Results:"
  echo "   Total: $TESTS_RUN"
  echo "   Passed: $TESTS_PASSED"
  echo "   Failed: $TESTS_FAILED"

  if [ $TESTS_FAILED -eq 0 ]; then
    echo "🎉 All tests passed!"
    exit 0
  else
    echo "💥 Some tests failed!"
    exit 1
  fi
}

# Run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
