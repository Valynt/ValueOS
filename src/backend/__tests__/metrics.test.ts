import request from 'supertest';
import app from '../server';
import { getMetricsRegistry } from '../../middleware/metricsMiddleware';

describe('Prometheus metrics', () => {
  afterEach(() => {
    getMetricsRegistry().resetMetrics();
  });

  it('exposes Prometheus formatted metrics', async () => {
    const response = await request(app).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('valuecanvas_http_request_duration_ms_bucket');
    expect(response.text).toContain('valuecanvas_http_requests_total');
  });

  it('adds route, method, and status code labels', async () => {
    await request(app).get('/health');
    const metricsResponse = await request(app).get('/metrics');

    expect(metricsResponse.text).toContain('route="/health"');
    expect(metricsResponse.text).toContain('method="GET"');
    expect(metricsResponse.text).toContain('status_code="200"');
  });
});
