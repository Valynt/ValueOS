import express from 'express';
import request from 'supertest';

import { getMetricsRegistry, metricsMiddleware } from '../middleware/metricsMiddleware';

describe('Prometheus metrics', () => {
  const app = express();

  app.use(metricsMiddleware());
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/metrics', async (_req, res) => {
    const registry = getMetricsRegistry();
    res.setHeader('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  });

  afterEach(() => {
    getMetricsRegistry().resetMetrics();
  });

  it('exposes Prometheus formatted metrics', async () => {
    await request(app).get('/health');
    const response = await request(app).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('valuecanvas_http_request_duration_ms_bucket');
    expect(response.text).toContain('valuecanvas_http_request_ttfb_ms_bucket');
    expect(response.text).toContain('valuecanvas_http_requests_total');
  });

  it('adds route, method, status code, and latency class labels', async () => {
    await request(app).get('/health');
    const metricsResponse = await request(app).get('/metrics');

    expect(metricsResponse.text).toContain('route="/health"');
    expect(metricsResponse.text).toContain('method="GET"');
    expect(metricsResponse.text).toContain('status_code="200"');
    expect(metricsResponse.text).toContain('latency_class="interactive"');
  });
});
