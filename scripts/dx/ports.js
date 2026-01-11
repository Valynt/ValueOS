import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../..');
const portsPath = path.join(projectRoot, 'config', 'ports.json');

const defaultPorts = {
  frontend: {
    port: 5173,
    hmrPort: 24678
  },
  backend: {
    port: 3001
  },
  postgres: {
    port: 5432
  },
  redis: {
    port: 6379
  },
  supabase: {
    apiPort: 54321,
    studioPort: 54323
  },
  edge: {
    httpPort: 8080,
    httpsPort: 8443,
    adminPort: 2019
  },
  observability: {
    prometheusPort: 9090,
    grafanaPort: 3000,
    jaegerPort: 16686,
    lokiPort: 3100,
    tempoPort: 3200,
    tempoOtlpGrpcPort: 4317,
    tempoOtlpHttpPort: 4318
  }
};

function mergeObjects(base, override) {
  const result = { ...base };
  if (!override || typeof override !== 'object') {
    return result;
  }

  Object.entries(override).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeObjects(base[key] ?? {}, value);
    } else {
      result[key] = value;
    }
  });

  return result;
}

export function loadPorts() {
  try {
    const raw = fs.readFileSync(portsPath, 'utf8');
    const parsed = JSON.parse(raw);
    return mergeObjects(defaultPorts, parsed);
  } catch (error) {
    return { ...defaultPorts };
  }
}

export function resolvePort(value, fallback) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

export function formatPortsEnv(ports) {
  return [
    '# Generated from config/ports.json',
    `VITE_PORT=${ports.frontend.port}`,
    `VITE_HMR_PORT=${ports.frontend.hmrPort}`,
    `API_PORT=${ports.backend.port}`,
    `POSTGRES_PORT=${ports.postgres.port}`,
    `REDIS_PORT=${ports.redis.port}`,
    `SUPABASE_API_PORT=${ports.supabase.apiPort}`,
    `SUPABASE_STUDIO_PORT=${ports.supabase.studioPort}`,
    `CADDY_HTTP_PORT=${ports.edge.httpPort}`,
    `CADDY_HTTPS_PORT=${ports.edge.httpsPort}`,
    `CADDY_ADMIN_PORT=${ports.edge.adminPort}`,
    `PROMETHEUS_PORT=${ports.observability.prometheusPort}`,
    `GRAFANA_PORT=${ports.observability.grafanaPort}`,
    `JAEGER_PORT=${ports.observability.jaegerPort}`,
    `LOKI_PORT=${ports.observability.lokiPort}`,
    `TEMPO_PORT=${ports.observability.tempoPort}`,
    `TEMPO_OTLP_GRPC_PORT=${ports.observability.tempoOtlpGrpcPort}`,
    `TEMPO_OTLP_HTTP_PORT=${ports.observability.tempoOtlpHttpPort}`,
    ''
  ].join('\n');
}

export function writePortsEnvFile(destination = path.join(projectRoot, '.env.ports')) {
  const ports = loadPorts();
  const content = formatPortsEnv(ports);
  fs.writeFileSync(destination, content, 'utf8');
  return destination;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputPath = writePortsEnvFile();
  console.log(`✅ Wrote ports env file to ${outputPath}`);
}
