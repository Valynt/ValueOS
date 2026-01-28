import client from "prom-client";

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["handler", "method", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
});

registry.registerMetric(httpRequestDuration);

export function metricsMiddleware(handlerName: string) {
  return async function metricsWrapper(req: any, res: any, next: any) {
    const end = httpRequestDuration.startTimer({ handler: handlerName, method: req.method });
    res.on("finish", () => {
      end({ status: String(res.statusCode) });
    });
    return next();
  };
}

export default registry;
