#!/usr/bin/env bats

# env.bats - Test environment variable handling

@test ".env.example exists" {
  [ -f ".env.example" ]
}

@test "dx:env:validate runs" {
  run pnpm run dx:env:validate
  [ "$status" -eq 0 ]
}
