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

function resolvePort({ envPort, urlValue, defaultPort }) {
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
  const frontendPort = resolvePort(process.env.VITE_PORT, ports.frontend.port);
  const backendPort = resolvePort(
    process.env.API_PORT || process.env.BACKEND_PORT || process.env.PORT,
    ports.backend.port
  );
  const databasePort = resolvePort(
    process.env.DB_PORT || process.env.POSTGRES_PORT,
    ports.postgres.port
  );
  const redisPort = resolvePort(process.env.REDIS_PORT, ports.redis.port);
  const supabaseApiPort = resolvePort(process.env.SUPABASE_API_PORT, ports.supabase.apiPort);
  const supabaseStudioPort = resolvePort(
    process.env.SUPABASE_STUDIO_PORT,
    ports.supabase.studioPort
  );

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
