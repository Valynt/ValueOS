import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const { metricsHandler, valueCaseHandler, benchmarksHandler } = vi.hoisted(() => ({
  metricsHandler: vi.fn((req, res) => {
    res.status(200).json({ token: req.params.token, period: req.query.period, metric_type: req.query.metric_type });
  }),
  valueCaseHandler: vi.fn((req, res) => {
    res.status(200).json({ token: req.params.token });
  }),
  benchmarksHandler: vi.fn((req, res) => {
    res.status(200).json({ token: req.params.token, industry: req.query.industry, kpi_name: req.query.kpi_name });
  }),
}));

vi.mock('../customer/metrics', () => ({
  getCustomerMetrics: metricsHandler,
}));

vi.mock('../customer/value-case', () => ({
  getCustomerValueCase: valueCaseHandler,
}));

vi.mock('../customer/benchmarks', () => ({
  getCustomerBenchmarks: benchmarksHandler,
}));

import customerRouter from '../customer';

describe('customer router sanitization', () => {
  it('sanitizes token and metrics query fields before invoking handler', async () => {
    const app = express();
    app.use('/api/customer', customerRouter);

    const response = await request(app)
      .get('/api/customer/metrics/%3Cscript%3Etoken%3C%2Fscript%3E?period=%3Cb%3E90d%3C%2Fb%3E&metric_type=%3Cimg%20src%3Dx%20onerror%3D1%3Ecost')
      .expect(200);

    expect(metricsHandler).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({
      token: 'token',
      period: '90d',
      metric_type: 'cost',
    });
  });

  it('sanitizes token and benchmark query fields before invoking handler', async () => {
    const app = express();
    app.use('/api/customer', customerRouter);

    const response = await request(app)
      .get('/api/customer/benchmarks/%3Cscript%3Etok%3C%2Fscript%3Een?industry=%3Ci%3Emanufacturing%3C%2Fi%3E&kpi_name=%3Cb%3ECAC%3C%2Fb%3E')
      .expect(200);

    expect(benchmarksHandler).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({
      token: 'token',
      industry: 'manufacturing',
      kpi_name: 'CAC',
    });
  });
});
