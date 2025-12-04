import express from 'express';

const SUPPORTED_VERSIONS = ['v1'];
const DEPRECATED_VERSIONS: string[] = [];
const DEFAULT_VERSION = 'v1';

function normalizeVersionHeader(headerValue: string | string[] | undefined): string | undefined {
  if (!headerValue) return undefined;
  return Array.isArray(headerValue) ? headerValue[0] : headerValue;
}

function getVersionFromPath(path: string): string | undefined {
  const match = path.match(/^\/(v\d+)(\/|$)/);
  return match?.[1];
}

export function createVersionedApiRouter(): express.Router {
  const router = express.Router();

  router.use((req, res, next) => {
    const pathVersion = getVersionFromPath(req.path);
    const headerVersion = normalizeVersionHeader(
      req.headers['x-api-version'] ?? req.headers['accept-version']
    );
    const resolvedVersion = pathVersion ?? headerVersion ?? DEFAULT_VERSION;

    if (!SUPPORTED_VERSIONS.includes(resolvedVersion)) {
      res.setHeader('API-Version', DEFAULT_VERSION);
      res.setHeader('API-Deprecated-Versions', DEPRECATED_VERSIONS.join(',') || 'none');
      return res.status(426).json({
        error: 'unsupported_version',
        message: `Version ${resolvedVersion} is not supported. Use ${DEFAULT_VERSION} or one of: ${SUPPORTED_VERSIONS.join(', ')}`,
      });
    }

    res.locals.apiVersion = resolvedVersion;
    res.setHeader('API-Version', resolvedVersion);
    if (DEPRECATED_VERSIONS.length > 0) {
      res.setHeader('API-Deprecated-Versions', DEPRECATED_VERSIONS.join(','));
    }

    if (pathVersion) {
      // Remove the version prefix from the path, preserving the query string
      const versionPrefix = `/${pathVersion}`;
      if (req.url.startsWith(versionPrefix)) {
        const newPath = req.url.slice(versionPrefix.length) || '/';
        req.url = newPath;
      }
    }

    next();
  });

  return router;
}

export const apiVersioningMetadata = {
  supported: SUPPORTED_VERSIONS,
  deprecated: DEPRECATED_VERSIONS,
  defaultVersion: DEFAULT_VERSION,
};
