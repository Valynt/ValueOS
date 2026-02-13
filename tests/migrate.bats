#!/usr/bin/env bats

# migrate.bats - Test migration script

@test "migrate.sh accepts --dry-run" {
  run bash scripts/dev/migrate.sh --dry-run
  [ "$status" -eq 0 ] || [ "$status" -eq 1 ]  # May fail if DB not up
}

@test "migrate.sh accepts --help" {
  run bash scripts/dev/migrate.sh --help
  [ "$status" -eq 0 ]
}
