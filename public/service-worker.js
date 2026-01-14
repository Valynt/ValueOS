/**
 * Service Worker for Offline Support
 *
 * Provides offline functionality, caching, and background sync
 * for the Canvas Workspace application.
 */

const CACHE_NAME = 'valueos-canvas-v1';
const STATIC_CACHE_NAME = 'valueos-static-v1';
const API_CACHE_NAME = 'valueos-api-v1';

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/static/icons/icon-192x192.png',
  '/static/icons/icon-512x512.png',
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/cases',
  '/api/workflow-state',
  '/api/user/session',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME &&
                cacheName !== STATIC_CACHE_NAME &&
                cacheName !== API_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with offline support
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request));
    return;
  }

  // Handle static asset requests
  if (STATIC_ASSETS.some(asset => url.pathname === asset)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Default: try network first, then cache
  event.respondWith(
    fetch(request)
      .catch(() => {
        return caches.match(request);
      })
  );
});

/**
 * Handle API requests with caching and offline support
 */
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  const method = request.method;

  // GET requests - try cache first, then network
  if (method === 'GET') {
    try {
      // Try network first for fresh data
      const response = await fetch(request);

      // Cache successful responses
      if (response.ok) {
        const cache = await caches.open(API_CACHE_NAME);
        cache.put(request, response.clone());
      }

      return response;
    } catch (error) {
      // Network failed, try cache
      const cachedResponse = await caches.match(request);

      if (cachedResponse) {
        console.log('Service Worker: Serving from cache:', request.url);
        return cachedResponse;
      }

      // Return offline response for specific endpoints
      if (API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint))) {
        return createOfflineResponse(request.url);
      }

      throw error;
    }
  }

  // POST/PUT/DELETE requests - try network, queue for background sync
  try {
    const response = await fetch(request);

    if (response.ok) {
      // Cache successful responses for GET-like operations
      if (method === 'POST' && url.pathname.includes('/create')) {
        const cache = await caches.open(API_CACHE_NAME);
        cache.put(request, response.clone());
      }
    }

    return response;
  } catch (error) {
    // Queue failed requests for background sync
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorker.prototype) {
      await queueRequestForSync(request);
    }

    throw error;
  }
}

/**
 * Handle static asset requests
 */
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    throw error;
  }
}

/**
 * Handle navigation requests
 */
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    // Return cached index.html for SPA navigation
    return caches.match('/index.html');
  }
}

/**
 * Create offline response for API requests
 */
function createOfflineResponse(url) {
  const urlPath = new URL(url).pathname;

  // Mock responses for different endpoints
  if (urlPath.includes('/cases')) {
    return new Response(JSON.stringify({
      error: 'Offline - serving cached data',
      data: [],
      offline: true,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (urlPath.includes('/workflow-state')) {
    return new Response(JSON.stringify({
      error: 'Offline - workflow state unavailable',
      offline: true,
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    error: 'Offline - service unavailable',
    offline: true,
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Queue failed requests for background sync
 */
async function queueRequestForSync(request) {
  const syncData = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    timestamp: Date.now(),
  };

  // Store in IndexedDB for background sync
  const db = await openSyncDB();
  const tx = db.transaction(['sync-queue'], 'readwrite');
  const store = tx.objectStore('sync-queue');

  await store.add(syncData);

  // Register for background sync
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorker.prototype) {
    await self.registration.sync.register('background-sync');
  }
}

/**
 * Open IndexedDB for sync queue
 */
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('valueos-sync-db', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('sync-queue')) {
        const store = db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(processSyncQueue());
  }
});

/**
 * Process queued requests when back online
 */
async function processSyncQueue() {
  try {
    const db = await openSyncDB();
    const tx = db.transaction(['sync-queue'], 'readwrite');
    const store = tx.objectStore('sync-queue');

    const requests = await store.getAll();

    for (const syncData of requests) {
      try {
        // Retry the request
        const response = await fetch(syncData.url, {
          method: syncData.method,
          headers: syncData.headers,
          body: syncData.body,
        });

        if (response.ok) {
          // Remove from queue on success
          await store.delete(syncData.id);
          console.log('Service Worker: Synced request:', syncData.url);
        }
      } catch (error) {
        console.error('Service Worker: Failed to sync request:', syncData.url, error);
      }
    }
  } catch (error) {
    console.error('Service Worker: Failed to process sync queue:', error);
  }
}

// Push notification event
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();

    const options = {
      body: data.body,
      icon: '/static/icons/icon-192x192.png',
      badge: '/static/icons/badge.png',
      tag: data.tag,
      data: data.data,
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  } else {
    // Default action - focus on existing window or open new one
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url === event.notification.data.url && 'focus' in client) {
              return client.focus();
            }
          }

          if (clients.openWindow) {
            return clients.openWindow(event.notification.data.url);
          }
        })
    );
  }
});

// Message event for communication with main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'FORCE_REFRESH') {
    clients.matchAll().then((clientList) => {
      clientList.forEach((client) => {
        client.navigate(client.url);
      });
    });
  }
});

console.log('Service Worker: Loaded');
