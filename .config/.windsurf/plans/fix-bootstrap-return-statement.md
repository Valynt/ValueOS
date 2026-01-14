# Fix Missing Return Statement in Bootstrap Function

This plan addresses the bug where the bootstrap function returns undefined when agent fabric is enabled and the agent health check completes successfully. The issue occurs because steps 7-8 and the final return statement are only executed in the else block, but the agent fabric path falls through without returning a BootstrapResult.

## Current Problem

- When `config.features.agentFabric && !skipAgentCheck` is true
- Agent health check completes successfully (no early returns triggered)
- Function falls through to line 323 and ends without returning
- Returns `undefined` instead of `BootstrapResult`

## Solution

Move steps 7, 8, and the final return statement outside the if-else block so they execute regardless of which path is taken. The else block should only contain the skip agent log message.

## Implementation Steps

1. Extract steps 7-8 (database connection check and cache initialization) from the else block
2. Extract the final summary and return statement from the else block
3. Place these steps after the if-else block to ensure they always execute
4. Keep only the skip agent log message in the else block
5. Ensure the function always returns a BootstrapResult object

## Files to Modify

- `/home/ino/ValueOS/src/bootstrap.ts` (lines 324-407)

## Expected Outcome

- Bootstrap function always returns BootstrapResult regardless of agent fabric path
- Steps 7-8 execute in both agent fabric and non-agent fabric paths
- No breaking changes to function signature or behavior
