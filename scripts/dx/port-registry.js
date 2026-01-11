#!/usr/bin/env node

/**
 * Shared port registry for DX scripts.
 * Uses config/ports.json as the single source of truth.
 */

import { loadPorts, resolvePort } from './ports.js';

function parseUrl(value) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function parsePort(value) {
  if (!value) {
    return null;
  }

  const port = Number(value);
  return Number.isNaN(port) ? null : port;
}

function resolvePortFromSources({ envPort, urlValue, defaultPort }) {
  const parsedEnvPort = parsePort(envPort);
  if (parsedEnvPort) {
    return parsedEnvPort;
  }

  const parsedUrl = parseUrl(urlValue);
  if (parsedUrl?.port) {
    return parsePort(parsedUrl.port);
  }

  return defaultPort;
}

function resolveHost(urlValue, fallback = 'localhost') {
  const parsedUrl = parseUrl(urlValue);
  return parsedUrl?.hostname || fallback;
}

export function getPortRegistry() {
  const ports = loadPorts();
  const frontendEnvUrl = process.env.VITE_APP_URL;
  const backendEnvUrl = process.env.BACKEND_URL;
  const supabaseApiEnvUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseStudioEnvUrl = process.env.SUPABASE_STUDIO_URL;
  const frontendPort = resolvePortFromSources({
    envPort: process.env.VITE_PORT,
    urlValue: frontendEnvUrl,
    defaultPort: ports.frontend.port
  });
  const backendPort = resolvePortFromSources({
    envPort: process.env.API_PORT || process.env.BACKEND_PORT || process.env.PORT,
    urlValue: backendEnvUrl,
    defaultPort: ports.backend.port
  });
  const databasePort = resolvePort(process.env.DB_PORT || process.env.POSTGRES_PORT, ports.postgres.port);
  const redisPort = resolvePort(process.env.REDIS_PORT, ports.redis.port);
  const supabaseApiPort = resolvePortFromSources({
    envPort: process.env.SUPABASE_API_PORT,
    urlValue: supabaseApiEnvUrl,
    defaultPort: ports.supabase.apiPort
  });
  const supabaseStudioPort = resolvePortFromSources({
    envPort: process.env.SUPABASE_STUDIO_PORT,
    urlValue: supabaseStudioEnvUrl,
    defaultPort: ports.supabase.studioPort
  });

  const frontendUrl = frontendEnvUrl || `http://localhost:${frontendPort}`;
  const backendUrl = backendEnvUrl || `http://localhost:${backendPort}`;
  const supabaseApiUrl = supabaseApiEnvUrl || `http://localhost:${supabaseApiPort}`;
  const supabaseStudioUrl = supabaseStudioEnvUrl || `http://localhost:${supabaseStudioPort}`;

  return {
    frontend: {
      port: frontendPort,
      url: frontendUrl,
      host: resolveHost(frontendUrl)
    },
    backend: {
      port: backendPort,
      url: backendUrl,
      host: resolveHost(backendUrl)
    },
    database: {
      port: databasePort,
      host: resolveHost(process.env.DATABASE_URL),
      address: `${resolveHost(process.env.DATABASE_URL)}:${databasePort}`
    },
    redis: {
      port: redisPort,
      host: resolveHost(process.env.REDIS_URL),
      address: `${resolveHost(process.env.REDIS_URL)}:${redisPort}`
    },
    supabase: {
      api: {
        port: supabaseApiPort,
        url: supabaseApiUrl
      },
      studio: {
        port: supabaseStudioPort,
        url: supabaseStudioUrl
      }
    }
  };
}

export default getPortRegistry;
