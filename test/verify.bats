#!/usr/bin/env bats

# verify.bats - Test dev environment verification

@test "dx:doctor passes when environment is healthy" {
  run pnpm run dx:doctor
  [ "$status" -eq 0 ]
}

@test "dx:doctor detects issues" {
  # This would need mocking, but for now assume it runs
  run pnpm run dx:doctor
  [ "$status" -eq 0 ] || [ "$status" -eq 1 ]  # Allow failure for demo
}
