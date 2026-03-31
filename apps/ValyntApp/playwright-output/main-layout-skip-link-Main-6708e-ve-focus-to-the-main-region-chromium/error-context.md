# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e4]: Loading...
  - generic [ref=e7]:
    - generic [ref=e8]: "[plugin:vite:esbuild] Transform failed with 1 error: /workspaces/ValueOS/apps/ValyntApp/src/components/common/LoadingSpinner.tsx:65:9: ERROR: Multiple exports with the same name \"LoadingSpinner\""
    - generic [ref=e9]: /workspaces/ValueOS/apps/ValyntApp/src/components/common/LoadingSpinner.tsx:46:9
    - generic [ref=e10]: "Multiple exports with the same name \"LoadingSpinner\" 63 | }_c = LoadingSpinner; 64 | 65 | export { LoadingSpinner };var _c;$RefreshReg$(_c, \"LoadingSpinner\"); | ^ 66 | 67 | if (import.meta.hot && !inWebWorker) {"
    - generic [ref=e11]: at failureErrorWithLog (/workspaces/ValueOS/node_modules/.pnpm/esbuild@0.21.5/node_modules/esbuild/lib/main.js:1472:15) at /workspaces/ValueOS/node_modules/.pnpm/esbuild@0.21.5/node_modules/esbuild/lib/main.js:755:50 at responseCallbacks.<computed> (/workspaces/ValueOS/node_modules/.pnpm/esbuild@0.21.5/node_modules/esbuild/lib/main.js:622:9) at handleIncomingPacket (/workspaces/ValueOS/node_modules/.pnpm/esbuild@0.21.5/node_modules/esbuild/lib/main.js:677:12) at Socket.readFromStdout (/workspaces/ValueOS/node_modules/.pnpm/esbuild@0.21.5/node_modules/esbuild/lib/main.js:600:7) at Socket.emit (node:events:524:28) at addChunk (node:internal/streams/readable:561:12) at readableAddChunkPushByteMode (node:internal/streams/readable:512:3) at Readable.push (node:internal/streams/readable:392:5) at Pipe.onStreamRead (node:internal/stream_base_commons:191:23
    - generic [ref=e12]:
      - text: Click outside, press Esc key, or fix the code to dismiss.
      - text: You can also disable this overlay by setting
      - code [ref=e13]: server.hmr.overlay
      - text: to
      - code [ref=e14]: "false"
      - text: in
      - code [ref=e15]: vite.config.ts
      - text: .
```