/**
 * MSW handlers for agent API endpoints.
 *
 * These handlers are used in tests that require network-level interception
 * (e.g., asserting request headers, testing SSE stream lifecycle).
 *
 * Usage: import { agentHandlers } from './agent' and pass to setupServer().
 *
 * NOTE: Activate by installing msw@^2 and uncommenting the imports below.
 * Until then, tests that need SSE mocking use a manual EventSource mock
 * (see src/hooks/__tests__/useAgentStream.test.ts).
 */

// import { http, HttpResponse } from 'msw';

// export const agentHandlers = [
//   // SSE stream for job status updates
//   http.get('/api/agents/jobs/:jobId/stream', ({ params }) => {
//     const { jobId } = params;
//     const encoder = new TextEncoder();
//     let closed = false;
//
//     const stream = new ReadableStream({
//       start(controller) {
//         // Emit a processing heartbeat
//         controller.enqueue(
//           encoder.encode(`id: evt-1\ndata: ${JSON.stringify({ status: 'processing', jobId })}\n\n`)
//         );
//         // Emit completion after a tick
//         setTimeout(() => {
//           if (!closed) {
//             controller.enqueue(
//               encoder.encode(
//                 `id: evt-2\ndata: ${JSON.stringify({ status: 'completed', jobId, result: 'done' })}\n\n`
//               )
//             );
//             controller.close();
//           }
//         }, 10);
//       },
//       cancel() {
//         closed = true;
//       },
//     });
//
//     return new HttpResponse(stream, {
//       headers: {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         Connection: 'keep-alive',
//       },
//     });
//   }),
//
//   // Agent invoke endpoint
//   http.post('/api/agents/:agentId/invoke', () => {
//     return HttpResponse.json({
//       data: { jobId: 'test-job-123', status: 'queued', mode: 'kafka' },
//     });
//   }),
//
//   // Job status polling
//   http.get('/api/agents/jobs/:jobId', ({ params }) => {
//     return HttpResponse.json({
//       data: { jobId: params.jobId, status: 'completed', result: 'done' },
//     });
//   }),
// ];

export const agentHandlers: never[] = [];
