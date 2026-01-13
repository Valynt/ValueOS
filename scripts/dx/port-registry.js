#!/usr/bin/env node

/**
 * Shared port registry for DX scripts.
 * Uses config/ports.json as the single source of truth.
 */

import { loadPorts, resolvePort as resolvePortFromConfig } from './ports.js';

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

function resolvePortFromEnvUrl({ envPort, urlValue, defaultPort }) {
  const parsedEnvPort = resolvePortFromConfig(envPort, null);
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
  const frontendPort = resolvePortFromEnvUrl({
    envPort: process.env.VITE_PORT,
    urlValue: process.env.VITE_APP_URL,
    defaultPort: ports.frontend.port
  });
  const backendPort = resolvePortFromEnvUrl({
    envPort: process.env.API_PORT || process.env.BACKEND_PORT || process.env.PORT,
    urlValue: process.env.BACKEND_URL,
    defaultPort: ports.backend.port
  });
  const databasePort = resolvePortFromEnvUrl({
    envPort: process.env.DB_PORT || process.env.POSTGRES_PORT,
    urlValue: process.env.DATABASE_URL,
    defaultPort: ports.postgres.port
  });
  const redisPort = resolvePortFromEnvUrl({
    envPort: process.env.REDIS_PORT,
    urlValue: process.env.REDIS_URL,
    defaultPort: ports.redis.port
  });
  const supabaseApiPort = resolvePortFromEnvUrl({
    envPort: process.env.SUPABASE_API_PORT,
    urlValue: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    defaultPort: ports.supabase.apiPort
  });
  const supabaseStudioPort = resolvePortFromEnvUrl({
    envPort: process.env.SUPABASE_STUDIO_PORT,
    urlValue: process.env.SUPABASE_STUDIO_URL,
    defaultPort: ports.supabase.studioPort
  });

  const frontendUrl = process.env.VITE_APP_URL || `http://localhost:${frontendPort}`;
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${backendPort}`;
  const supabaseApiUrl =
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || `http://localhost:${supabaseApiPort}`;
  const supabaseStudioUrl = process.env.SUPABASE_STUDIO_URL || `http://localhost:${supabaseStudioPort}`;

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
