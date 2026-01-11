#!/usr/bin/env node

/**
 * Shared port registry for DX scripts.
 */

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
  const frontendPort = resolvePort({
    envPort: process.env.VITE_PORT,
    urlValue: process.env.VITE_APP_URL,
    defaultPort: 5173
  });
  const backendPort = resolvePort({
    envPort: process.env.API_PORT || process.env.BACKEND_PORT || process.env.PORT,
    urlValue: process.env.BACKEND_URL,
    defaultPort: 3001
  });
  const databasePort = resolvePort({
    envPort: process.env.DB_PORT || process.env.POSTGRES_PORT,
    urlValue: process.env.DATABASE_URL,
    defaultPort: 5432
  });
  const redisPort = resolvePort({
    envPort: process.env.REDIS_PORT,
    urlValue: process.env.REDIS_URL,
    defaultPort: 6379
  });
  const supabaseApiPort = resolvePort({
    envPort: process.env.SUPABASE_API_PORT,
    urlValue: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    defaultPort: 54321
  });
  const supabaseStudioPort = resolvePort({
    envPort: process.env.SUPABASE_STUDIO_PORT,
    urlValue: process.env.SUPABASE_STUDIO_URL,
    defaultPort: 54323
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
