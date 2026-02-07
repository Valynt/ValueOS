#!/usr/bin/env node

/**
 * Metrics Exporter
 *
 * Exposes Prometheus metrics for the ValueOS application.
 * Provides HTTP request metrics including 4xx/5xx rates and latency.
 */

const express = require('express');
const { register, collectDefaultMetrics, Gauge, Counter, Histogram } = require('prom-client');

// Enable default metrics collection (CPU, memory, etc.)
collectDefaultMetrics({ prefix: 'valueos_' });

// Custom metrics
const httpRequestsTotal = new Counter({
  name: 'valueos_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new Histogram({
  name: 'valueos_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const activeConnections = new Gauge({
  name: 'valueos_active_connections',
  help: 'Number of active connections'
});

// Express app for metrics endpoint
const app = express();

// Middleware to track HTTP metrics
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;

    httpRequestsTotal
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .inc();

    httpRequestDuration
      .labels(req.method, req.route?.path || req.path)
      .observe(duration);
  });

  next();
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Start server
const PORT = process.env.METRICS_PORT || 9464;
app.listen(PORT, () => {
  console.log(`Metrics server listening on port ${PORT}`);
  console.log(`Metrics available at http://localhost:${PORT}/metrics`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down metrics server...');
  process.exit(0);
});
