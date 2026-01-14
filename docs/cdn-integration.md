# CDN Integration and Edge Caching Strategy

# Cloudflare integration with stale-while-revalidate and serve-on-error policies

## Overview

ValueOS implements a comprehensive CDN strategy using Cloudflare to provide global edge caching, DDoS protection, and improved performance for static assets and API responses.

## CDN Configuration

### 1. Cloudflare Zone Setup

#### DNS Configuration

```json
{
  "zone": {
    "name": "valueos.com",
    "jump_start": true,
    "type": "full"
  },
  "dns_records": [
    {
      "type": "A",
      "name": "@",
      "content": "192.0.2.1",
      "ttl": 1,
      "proxied": true
    },
    {
      "type": "A",
      "name": "www",
      "content": "192.0.2.1",
      "ttl": 1,
      "proxied": true
    },
    {
      "type": "CNAME",
      "name": "api",
      "content": "api.valueos.com",
      "ttl": 1,
      "proxied": true
    }
  ]
}
```

#### SSL/TLS Configuration

```json
{
  "ssl_settings": {
    "certificate": "valueos.com",
    "certificate_status": "active",
    "ssl": "strict",
    "tls_1_3": "on",
    "min_tls_version": "1.2",
    "certificate_pack": "origin_ca",
    "https_rewrites": {
      "enabled": true
    }
  }
}
```

### 2. Cache Rules Configuration

#### Static Assets Cache Rules

```json
{
  "cache_rules": [
    {
      "id": "static_assets",
      "description": "Cache static assets for 1 year",
      "action": "cache",
      "filter": {
        "expression": "(http.request.uri.path.extension in {\"js\" \"css\" \"png\" \"jpg\" \"jpeg\" \"gif\" \"svg\" \"ico\" \"woff\" \"woff2\" \"ttf\" \"eot\" \"webm\" \"mp4\"})"
      },
      "cache_ttl": {
        "value": 31536000,
        "mode": "respect_origin"
      },
      "browser_cache_ttl": {
        "value": 31536000,
        "mode": "respect_origin"
      },
      "edge_ttl": {
        "value": 31536000,
        "mode": "override_origin"
      }
    },
    {
      "id": "api_responses",
      "description": "Cache API responses for 5 minutes",
      "action": "cache",
      "filter": {
        "expression": "(http.request.uri.path matches \"^/api/\" && http.response.status_code in {200 201 202 204})"
      },
      "cache_ttl": {
        "value": 300,
        "mode": "respect_origin"
      },
      "browser_cache_ttl": {
        "value": 0,
        "mode": "override_origin"
      },
      "edge_ttl": {
        "value": 300,
        "mode": "override_origin"
      },
      "cache_key": {
        "cache_by_device_type": false,
        "cache_deception_armor": false,
        "custom_key": [
          "http.request.uri.path",
          "http.request.uri.query",
          "http.request.headers.accept-language"
        ]
      }
    },
    {
      "id": "html_pages",
      "description": "Cache HTML pages with stale-while-revalidate",
      "action": "cache",
      "filter": {
        "expression": "(http.request.uri.path.extension in {\"html\" \"htm\"} || http.request.uri.path eq \"/\")"
      },
      "cache_ttl": {
        "value": 3600,
        "mode": "respect_origin"
      },
      "browser_cache_ttl": {
        "value": 300,
        "mode": "respect_origin"
      },
      "edge_ttl": {
        "value": 3600,
        "mode": "override_origin"
      },
      "stale_while_revalidate": {
        "value": 86400,
        "mode": "override_origin"
      },
      "stale_if_error": {
        "value": 604800,
        "mode": "override_origin"
      }
    }
  ]
}
```

### 3. Page Rules Configuration

#### Performance Optimization Rules

```json
{
  "page_rules": [
    {
      "targets": [
        {
          "target": "url",
          "constraint": {
            "operator": "matches",
            "value": "valueos.com/*"
          }
        }
      ],
      "actions": [
        {
          "id": "cache_level",
          "value": "cache_everything"
        },
        {
          "id": "edge_cache_ttl",
          "value": 3600
        },
        {
          "id": "browser_cache_ttl",
          "value": 300
        },
        {
          "id": "cache_key_fields",
          "value": ["scheme", "host", "uri", "query", "cookie", "header", "user_device_type"]
        }
      ]
    },
    {
      "targets": [
        {
          "target": "url",
          "constraint": {
            "operator": "matches",
            "value": "valueos.com/assets/*"
          }
        }
      ],
      "actions": [
        {
          "id": "cache_level",
          "value": "cache_everything"
        },
        {
          "id": "edge_cache_ttl",
          "value": 31536000
        },
        {
          "id": "browser_cache_ttl",
          "value": 31536000
        },
        {
          "id": "cache_key_fields",
          "value": ["scheme", "host", "uri"]
        }
      ]
    },
    {
      "targets": [
        {
          "target": "url",
          "constraint": {
            "operator": "matches",
            "value": "valueos.com/api/*"
          }
        }
      ],
      "actions": [
        {
          "id": "cache_level",
          "value": "cache_everything"
        },
        {
          "id": "edge_cache_ttl",
          "value": 300
        },
        {
          "id": "browser_cache_ttl",
          "value": 0
        },
        {
          "id": "cache_key_fields",
          "value": ["scheme", "host", "uri", "query", "header"]
        }
      ]
    }
  ]
}
```

### 4. Origin Configuration

#### Nginx CDN Headers

```nginx
# Add CDN-specific headers
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    # Cache control headers for CDN
    add_header Cache-Control "public, max-age=31536000, immutable, stale-while-revalidate=86400, stale-if-error=604800";
    add_header X-CDN-Cache-Status "HIT";
    add_header X-Content-Digest "";

    # Cloudflare-specific headers
    add_header CF-Cache-Status "HIT";
    add_header CF-Ray $http_cf_ray;

    expires 1y;
    access_log off;
}

location /api {
    # API caching headers
    add_header Cache-Control "public, max-age=300, stale-while-revalidate=60, stale-if-error=300";
    add_header X-CDN-Cache-Status "DYNAMIC";

    # CORS headers for CDN
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
    add_header Access-Control-Allow-Headers "Content-Type, Authorization";

    proxy_pass http://backend;
}

location / {
    # HTML pages with SWR
    add_header Cache-Control "public, max-age=3600, stale-while-revalidate=86400, stale-if-error=604800";
    add_header X-CDN-Cache-Status "REVALIDATE";

    try_files $uri $uri/ /index.html;
}
```

### 5. Stale-While-Revalidate Implementation

#### Service Worker for Background Sync

```javascript
// Service worker for stale-while-revalidate
const CACHE_NAME = "valueos-v1";
const STALE_WHILE_REVALIDATE = 86400; // 24 hours
const STALE_IF_ERROR = 604800; // 7 days

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Static assets - cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API responses - network first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // HTML pages - stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    // Check if cache is stale
    const cachedTime = new Date(cached.headers.get("cached-time"));
    const now = new Date();
    const age = (now - cachedTime) / 1000;

    if (age < STALE_WHILE_REVALIDATE) {
      // Cache is fresh, return it
      return cached;
    } else {
      // Cache is stale, return it and revalidate in background
      revalidateInBackground(request, cache);
      return cached;
    }
  }

  // No cache, fetch from network
  return fetchAndCache(request, cache);
}

async function revalidateInBackground(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cachedResponse = response.clone();
      cachedResponse.headers.set("cached-time", new Date().toISOString());
      await cache.put(request, cachedResponse);
    }
  } catch (error) {
    console.log("Background revalidation failed:", error);
  }
}

async function fetchAndCache(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cachedResponse = response.clone();
      cachedResponse.headers.set("cached-time", new Date().toISOString());
      await cache.put(request, cachedResponse);
      return response;
    }
    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    // Network failed, try to serve stale cache
    const stale = await cache.match(request);
    if (stale) {
      const cachedTime = new Date(stale.headers.get("cached-time"));
      const now = new Date();
      const age = (now - cachedTime) / 1000;

      if (age < STALE_IF_ERROR) {
        return stale;
      }
    }
    throw error;
  }
}

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webm|mp4)$/.test(pathname);
}
```

### 6. Edge Functions for Dynamic Content

#### Cloudflare Workers Configuration

```javascript
// Cloudflare Worker for dynamic caching logic
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const cf = request.cf;

  // Add custom headers for tracking
  const response = await fetch(request);

  // Modify response headers for CDN
  const newResponse = new Response(response.body, response);

  // Add CDN-specific headers
  newResponse.headers.set("X-CDN-Cache-Status", "DYNAMIC");
  newResponse.headers.set("X-Edge-Location", cf.colo);
  newResponse.headers.set("X-Country", cf.country);

  // Cache control based on content type
  const contentType = newResponse.headers.get("content-type") || "";

  if (contentType.includes("text/html")) {
    newResponse.headers.set(
      "Cache-Control",
      "public, max-age=3600, stale-while-revalidate=86400, stale-if-error=604800"
    );
  } else if (contentType.includes("application/json")) {
    newResponse.headers.set(
      "Cache-Control",
      "public, max-age=300, stale-while-revalidate=60, stale-if-error=300"
    );
  } else if (isStaticAsset(contentType)) {
    newResponse.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  return newResponse;
}

function isStaticAsset(contentType) {
  return (
    contentType.includes("text/javascript") ||
    contentType.includes("text/css") ||
    contentType.includes("image/") ||
    contentType.includes("font/") ||
    contentType.includes("application/octet-stream")
  );
}
```

### 7. Cache Invalidation Strategy

#### Automatic Cache Purge

```javascript
// Cache invalidation script
const Cloudflare = require("cloudflare");

const cf = new Cloudflare({
  email: process.env.CLOUDFLARE_EMAIL,
  key: process.env.CLOUDFLARE_API_KEY,
});

async function purgeCache(patterns) {
  try {
    const result = await cf.zones.purgeCache("zone_id", {
      files: patterns,
    });

    console.log("Cache purged successfully:", result);
    return result;
  } catch (error) {
    console.error("Cache purge failed:", error);
    throw error;
  }
}

// Purge specific assets on deployment
async function purgeOnDeployment() {
  const patterns = [
    "https://valueos.com/*",
    "https://www.valueos.com/*",
    "https://api.valueos.com/*",
  ];

  await purgeCache(patterns);
}

// Purge API cache on data updates
async function purgeApiCache(endpoint) {
  const patterns = [`https://api.valueos.com${endpoint}*`];

  await purgeCache(patterns);
}
```

#### Webhook Integration

```yaml
# GitHub Actions webhook for cache invalidation
apiVersion: v1
kind: Secret
metadata:
  name: cloudflare-webhook
  namespace: valueos-ha
data:
  webhook-url: <BASE64_ENCODED_WEBHOOK_URL>
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: cache-invalidation
  namespace: valueos-ha
data:
  webhook-handler.js: |
    const express = require('express');
    const crypto = require('crypto');
    const { execSync } = require('child_process');

    const app = express();
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

    app.post('/webhook/cache-invalidate', (req, res) => {
      const signature = req.headers['x-hub-signature-256'];
      const hash = 'sha256=' + crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');
      
      if (signature !== hash) {
        return res.status(401).send('Invalid signature');
      }
      
      // Invalidate cache on deployment
      if (req.body.ref === 'refs/heads/main') {
        execSync('/scripts/purge-cache.sh', { stdio: 'inherit' });
      }
      
      res.status(200).send('Cache invalidated');
    });

    app.listen(3000, () => {
      console.log('Webhook server listening on port 3000');
    });
```

### 8. Performance Monitoring

#### CDN Analytics Dashboard

```yaml
# Grafana dashboard for CDN metrics
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-cdn-dashboard
  namespace: valueos-ha
data:
  cdn-analytics.json: |
    {
      "dashboard": {
        "title": "ValueOS CDN Analytics",
        "panels": [
          {
            "title": "Cache Hit Ratio",
            "type": "stat",
            "targets": [
              {
                "expr": "cloudflare_cache_hit_ratio",
                "legendFormat": "Hit Ratio"
              }
            ]
          },
          {
            "title": "Edge Response Time",
            "type": "graph",
            "targets": [
              {
                "expr": "cloudflare_edge_response_time_seconds",
                "legendFormat": "{{edge_location}}"
              }
            ]
          },
          {
            "title": "Bandwidth Usage",
            "type": "graph",
            "targets": [
              {
                "expr": "cloudflare_bandwidth_bytes",
                "legendFormat": "{{zone}}"
              }
            ]
          },
          {
            "title": "Request Count by Region",
            "type": "graph",
            "targets": [
              {
                "expr": "cloudflare_requests_total",
                "legendFormat": "{{country}}"
              }
            ]
          }
        ]
      }
    }
```

#### Real-time Metrics Collection

```javascript
// Cloudflare Analytics API integration
const Cloudflare = require("cloudflare");

class CDNAnalytics {
  constructor() {
    this.cf = new Cloudflare({
      email: process.env.CLOUDFLARE_EMAIL,
      key: process.env.CLOUDFLARE_API_KEY,
    });
  }

  async getAnalytics(zoneId, since, until) {
    try {
      const analytics = await this.cf.zones.analyticsDashboard(zoneId, {
        since: since.toISOString(),
        until: until.toISOString(),
      });

      return {
        requests: analytics.totals.requests,
        bandwidth: analytics.totals.bandwidth,
        threats: analytics.totals.threats,
        pageviews: analytics.totals.pageviews,
        uniques: analytics.totals.uniques,
      };
    } catch (error) {
      console.error("Failed to fetch CDN analytics:", error);
      throw error;
    }
  }

  async getCacheAnalytics(zoneId) {
    try {
      const cache = await this.cf.zones.cacheStats(zoneId);

      return {
        cacheHits: cache.cacheHits,
        cacheMisses: cache.cacheMisses,
        hitRatio: cache.cacheHits / (cache.cacheHits + cache.cacheMisses),
      };
    } catch (error) {
      console.error("Failed to fetch cache analytics:", error);
      throw error;
    }
  }
}

module.exports = CDNAnalytics;
```

### 9. Security Configuration

#### DDoS Protection

```json
{
  "ddos_protection": {
    "mode": "advanced_ddos",
    "ddos_protection_status": "active",
    "id": "ddos_protection",
    "value": "on",
    "editable": true
  },
  "waf": {
    "mode": "high",
    "waf": "on",
    "firewall": {
      "rules": [
        {
          "id": "sql_injection",
          "action": "block",
          "description": "Block SQL injection attempts"
        },
        {
          "id": "xss_protection",
          "action": "block",
          "description": "Block XSS attempts"
        }
      ]
    }
  },
  "rate_limiting": {
    "rules": [
      {
        "id": "api_rate_limit",
        "threshold": 100,
        "period": 60,
        "match": {
          "request": {
            "url": {
              "pattern": "api.valueos.com/*"
            }
          }
        }
      }
    ]
  }
}
```

### 10. Deployment and Testing

#### CDN Deployment Script

```bash
#!/bin/bash
# CDN deployment and validation script

set -euo pipefail

CLOUDFLARE_EMAIL=${CLOUDFLARE_EMAIL}
CLOUDFLARE_API_KEY=${CLOUDFLARE_API_KEY}
ZONE_ID=${ZONE_ID}

echo "Deploying CDN configuration..."

# 1. Update DNS records
echo "Updating DNS records..."
curl -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "X-Auth-Email: $CLOUDFLARE_EMAIL" \
  -H "X-Auth-Key: $CLOUDFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  --data @dns-config.json

# 2. Configure cache rules
echo "Configuring cache rules..."
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/cache_rules" \
  -H "X-Auth-Email: $CLOUDFLARE_EMAIL" \
  -H "X-Auth-Key: $CLOUDFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  --data @cache-rules.json

# 3. Configure page rules
echo "Configuring page rules..."
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/pagerules" \
  -H "X-Auth-Email: $CLOUDFLARE_EMAIL" \
  -H "X-Auth-Key: $CLOUDFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  --data @page-rules.json

# 4. Purge cache
echo "Purging cache..."
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "X-Auth-Email: $CLOUDFLARE_EMAIL" \
  -H "X-Auth-Key: $CLOUDFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# 5. Validate deployment
echo "Validating CDN deployment..."
sleep 30

# Test static asset caching
curl -I -s "https://valueos.com/assets/main.js" | grep -i "cache-control"
curl -I -s "https://valueos.com/assets/main.js" | grep -i "cf-cache-status"

# Test API caching
curl -I -s "https://api.valueos.com/health" | grep -i "cache-control"

echo "CDN deployment completed successfully!"
```

#### Performance Testing

```bash
#!/bin/bash
# CDN performance testing script

echo "Testing CDN performance..."

# Test edge locations
locations=("us-east" "eu-west" "ap-southeast" "ap-northeast")

for location in "${locations[@]}"; do
  echo "Testing $location..."

  # Test static asset
  curl -w "@curl-format.txt" -s -o /dev/null \
    "https://valueos.com/assets/main.js" \
    --resolve "valueos.com:443:$location.edge.cloudflare.com"

  # Test API endpoint
  curl -w "@curl-format.txt" -s -o /dev/null \
    "https://api.valueos.com/health" \
    --resolve "api.valueos.com:443:$location.edge.cloudflare.com"
done

# Test cache hit ratio
echo "Testing cache hit ratio..."
for i in {1..10}; do
  curl -I -s "https://valueos.com/assets/main.js" | grep -i "cf-cache-status"
done

echo "Performance testing completed!"
```

This comprehensive CDN integration strategy provides global edge caching, improved performance, and resilience for the ValueOS application while maintaining security and reliability.
