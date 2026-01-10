## 2024-05-22 - React Re-rendering Optimization

**Learning:** When using components inside a parent component that has frequent state updates (like streaming text), ensure the children are memoized. Even if defined outside, passing a new closure (like `onClick`) every render breaks memoization.
**Action:** Extract list items to separate memoized components and use `useCallback` for handlers to ensure prop stability.
