# Fix Invalid Find -exec Syntax Missing Terminator

This plan addresses the bug where the find command is missing the required terminator for the -exec argument, causing Docker build failures.

## Current Problem

- Line 68: `find dist -type f -exec sha256sum {} \> /tmp/build-checksums.txt`
- Missing terminator (`\;` or `+`) for the -exec argument
- The `\>` is being interpreted as part of the -exec command instead of a redirect
- Find command fails with 'missing argument to -exec' error
- Docker build fails at the app-builder stage

## Solution

Add the proper terminator `\;` before the redirect operator to complete the -exec syntax.

## Implementation Steps

1. Replace `\>` with `\; >` in the find command
2. Ensure proper spacing between terminator and redirect
3. Verify the command syntax is correct

## Files to Modify

- `/home/ino/ValueOS/Dockerfile.ha-frontend` (line 68)

## Expected Outcome

- Find command executes successfully
- Build checksums are generated properly
- Docker build completes without syntax errors
