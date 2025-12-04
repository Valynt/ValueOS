import { Router } from 'express';

const router = Router();

const pingIfAvailable = async (client) => {
  if (!client) {
    return { ready: false, reason: 'not configured' };
  }

  if (typeof client.ping === 'function') {
    await client.ping();
  }

  return { ready: true };
};

// Liveness probe - is the service running?
router.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Readiness probe - is the service ready to accept traffic?
router.get('/ready', async (req, res) => {
  const dbClient = req.app?.locals?.db;
  const redisClient = req.app?.locals?.redis;

  try {
    const [dbStatus, redisStatus] = await Promise.all([
      pingIfAvailable(dbClient),
      pingIfAvailable(redisClient),
    ]);

    if (!dbStatus.ready || !redisStatus.ready) {
      return res.status(503).json({
        status: 'not ready',
        database: dbStatus.ready ? 'connected' : dbStatus.reason,
        redis: redisStatus.ready ? 'connected' : redisStatus.reason,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      status: 'ready',
      database: 'connected',
      redis: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      status: 'not ready',
      error: error.message,
    });
  }
});

export default router;
