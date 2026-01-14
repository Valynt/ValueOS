# Fix Duplicate Nginx User/Group Creation in Dockerfile

This plan addresses the bug where the Dockerfile attempts to create nginx user/group that already exists in the nginx:bookworm base image, causing Docker build failures.

## Current Problem

- Lines 101-102 attempt to create nginx user (UID 101) and group (GID 101)
- nginx:bookworm base image already includes these user/group
- `groupadd -r -g 101 nginx` fails with 'group nginx already exists'
- Docker build fails during the RUN instruction

## Solution

Remove the groupadd and useradd commands since the nginx image already has the nginx user. Keep only the directory creation and permission setting commands.

## Implementation Steps

1. Remove `groupadd -r -g 101 nginx` command
2. Remove `useradd -r -g nginx -u 101 -s /sbin/nologin nginx` command
3. Keep mkdir, chown, and chmod commands for directory setup
4. Verify the nginx user exists before using it in chown commands

## Files to Modify

- `/home/ino/ValueOS/Dockerfile.ha-frontend` (lines 101-105)

## Expected Outcome

- Docker build succeeds without user/group creation conflicts
- Nginx directories are properly created with correct permissions
- No functional changes to the runtime behavior
