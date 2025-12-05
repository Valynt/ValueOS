# Gateway Security Configuration Comparison

## Quick Answer: **Yes, you NEED this for production!**

Security headers **must** be set at the gateway/edge level (Nginx/Envoy/Istio) for several critical reasons:

1. **Defense in Depth** - Headers apply before reaching your application
2. **Centralized Security** - One place to manage security for all services
3. **Protection Against Zero-Days** - Blocks attacks even if your app has vulnerabilities
4. **Compliance** - OWASP, PCI-DSS, SOC 2 require edge-level security
5. **Performance** - Gateway can handle security checks efficiently

---

## Which Gateway Should You Use?

| Gateway | Use When | Complexity | Features |
|---------|----------|------------|----------|
| **Nginx** | Simple deployments, VM-based, traditional infra | ⭐ Low | Great for most cases |
| **Envoy** | Cloud-native, need advanced features | ⭐⭐ Medium | Modern, flexible |
| **Istio** | Kubernetes, service mesh, mTLS required | ⭐⭐⭐ High | Full service mesh |

---

## Feature Comparison

| Feature | Nginx | Envoy | Istio |
|---------|-------|-------|-------|
| Security Headers | ✅ Simple | ✅ Config-heavy | ✅ Via EnvoyFilter |
| Rate Limiting | ✅ Built-in | ✅ External service | ✅ Built-in |
| TLS Termination | ✅ Easy | ✅ Easy | ✅ Automatic |
| mTLS (Phase 2) | ❌ Manual | ⚠️ Possible | ✅ Automatic |
| Service Discovery | ❌ Static | ✅ Dynamic | ✅ Automatic |
| Observability | ⚠️ Basic | ✅ Advanced | ✅ Full stack |
| Learning Curve | Easy | Medium | Hard |

---

## Configuration Files Created

### 1. Nginx Configuration
**File:** `infrastructure/gateway/nginx-security-headers.conf`

**Features:**
- ✅ All security headers
- ✅ Rate limiting for auth endpoints (5 req/min)
- ✅ TLS 1.2+ with strong ciphers
- ✅ HTTP → HTTPS redirect
- ✅ Static asset caching

**Deploy:**
```bash
# Copy config
sudo cp nginx-security-headers.conf /etc/nginx/conf.d/

# Test config
sudo nginx -t

# Reload
sudo nginx -s reload
```

**Pros:**
- Simple, proven, fast
- Great documentation
- Low resource usage

**Cons:**
- No built-in service mesh
- Manual service discovery
- Limited observability

---

### 2. Envoy Configuration
**File:** `infrastructure/gateway/envoy-security-config.yaml`

**Features:**
- ✅ All security headers
- ✅ Advanced rate limiting with external service
- ✅ gRPC support
- ✅ Dynamic configuration
- ✅ Circuit breaking

**Deploy:**
```bash
# Validate config
envoy --config-path envoy-security-config.yaml --mode validate

# Run Envoy
envoy -c envoy-security-config.yaml
```

**Pros:**
- Modern, cloud-native
- Great observability
- Dynamic configuration

**Cons:**
- More complex than Nginx
- Requires external rate limit service
- Steeper learning curve

---

### 3. Istio Configuration
**File:** `infrastructure/gateway/istio-security-config.yaml`

**Features:**
- ✅ All security headers via Lua script
- ✅ **Automatic mTLS** (Phase 2 requirement!)
- ✅ Service mesh capabilities
- ✅ Advanced traffic management
- ✅ Built-in observability (Kiali, Grafana, Jaeger)

**Deploy:**
```bash
# Apply all configs
kubectl apply -f istio-security-config.yaml

# Verify
kubectl get gateway,virtualservice,peerauthentication -n valuecanvas
```

**Pros:**
- **Best for Kubernetes**
- Automatic mTLS between services
- Full observability stack
- Advanced traffic control

**Cons:**
- Kubernetes only
- Resource intensive
- Steepest learning curve

---

## Recommended Security Headers (All Gateways)

### 1. Content-Security-Policy (CSP)
```
default-src 'self'; 
img-src 'self' data: https:; 
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; 
script-src 'self'; 
connect-src 'self' https://*.supabase.co wss://*.supabase.co; 
font-src 'self' data: https://fonts.gstatic.com; 
object-src 'none'; 
base-uri 'self'; 
form-action 'self'; 
frame-ancestors 'none'; 
upgrade-insecure-requests
```

**What it does:** Prevents XSS attacks by whitelisting content sources

### 2. Strict-Transport-Security (HSTS)
```
max-age=31536000; includeSubDomains; preload
```

**What it does:** Forces HTTPS for 1 year, including all subdomains

### 3. X-Frame-Options
```
DENY
```

**What it does:** Prevents clickjacking by blocking iframe embedding

### 4. X-Content-Type-Options
```
nosniff
```

**What it does:** Prevents MIME type sniffing attacks

### 5. Referrer-Policy
```
strict-origin-when-cross-origin
```

**What it does:** Controls referrer information sent to other sites

### 6. X-XSS-Protection
```
1; mode=block
```

**What it does:** Enables browser XSS filter (legacy browsers)

### 7. Permissions-Policy
```
geolocation=(), microphone=(), camera=(), payment=()
```

**What it does:** Restricts browser features/APIs

---

## Rate Limiting Configuration

### Nginx
```nginx
# /etc/nginx/nginx.conf (http block)
limit_req_zone $binary_remote_addr zone=auth_zone:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api_zone:10m rate=60r/m;

# In server block
location /auth/ {
    limit_req zone=auth_zone burst=3 nodelay;
    limit_req_status 429;
    proxy_pass http://backend;
}
```

### Envoy
Requires external rate limit service (e.g., Envoy Rate Limit Service)

### Istio
Use `EnvoyFilter` with local rate limiting or external service

---

## Verification Script

Created: `infrastructure/gateway/verify-security-headers.sh`

```bash
#!/bin/bash
# Verify security headers are properly set

URL="${1:-https://valuecanvas.example.com}"

echo "🔍 Verifying security headers for: $URL"
echo ""

# Check headers
curl -sI "$URL" | grep -Ei \
  'content-security-policy|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|x-xss-protection|permissions-policy' \
  || echo "❌ Missing security headers!"

echo ""
echo "✅ If you see headers above, configuration is correct!"
```

---

## Decision Matrix

### Choose Nginx if:
- ✅ You're on VMs or traditional infrastructure
- ✅ You want simple, proven technology
- ✅ You don't need service mesh features
- ✅ You want low resource overhead
- ✅ Your team knows Nginx well

### Choose Envoy if:
- ✅ You need modern cloud-native features
- ✅ You want advanced observability
- ✅ You're using gRPC heavily
- ✅ You need dynamic configuration
- ✅ You're planning to adopt service mesh later

### Choose Istio if:
- ✅ **You're on Kubernetes** (required!)
- ✅ **You need mTLS** (Phase 2 requirement!)
- ✅ You want full service mesh
- ✅ You need advanced traffic management
- ✅ You want built-in observability
- ✅ Your team can handle the complexity

---

## Phase 1 & 2 Requirements

### Phase 1: Gateway Security
- ✅ Security headers at edge - **ALL GATEWAYS**
- ✅ Rate limiting on auth endpoints - **ALL GATEWAYS**
- ✅ TLS 1.2+ - **ALL GATEWAYS**
- ✅ HTTP → HTTPS redirect - **ALL GATEWAYS**

### Phase 2: Service Mesh
- ✅ mTLS between services - **ISTIO RECOMMENDED**
- ✅ Service identity - **ISTIO AUTOMATIC**
- ⚠️ Network policies - **KUBERNETES REQUIRED**

**Recommendation:** Start with Nginx for Phase 1, migrate to Istio for Phase 2 if on Kubernetes.

---

## Testing Checklist

### Before Production
- [ ] Test CSP doesn't break your app (check browser console)
- [ ] Verify HSTS max-age is appropriate (start with 300, increase to 31536000)
- [ ] Test rate limiting with load testing tool
- [ ] Verify TLS ciphers are secure (use SSL Labs)
- [ ] Check headers with SecurityHeaders.com
- [ ] Test from multiple locations/networks
- [ ] Verify mobile app compatibility

### After Deployment
- [ ] Monitor rate limit blocks (are legitimate users affected?)
- [ ] Check for CSP violations in logs
- [ ] Verify HTTPS redirection works
- [ ] Test failover/redundancy
- [ ] Check response times (headers shouldn't slow things down)

---

## Common Mistakes to Avoid

### ❌ Don't Do This:
1. **Setting headers in app only** - Can be bypassed
2. **Using `add_header` in Nginx without `always`** - Won't work on error responses
3. **Too strict CSP initially** - Test in report-only mode first
4. **Forgetting WebSocket URLs** in CSP `connect-src`
5. **Not testing rate limits** - May block legitimate traffic

### ✅ Do This:
1. Set headers at gateway level
2. Use `always` flag in Nginx
3. Start with relaxed CSP, tighten gradually
4. Include all necessary origins (Supabase, CDNs, etc.)
5. Load test before production

---

## Quick Start by Scenario

### Scenario 1: Simple App on VMs
**Use: Nginx**
```bash
cp infrastructure/gateway/nginx-security-headers.conf /etc/nginx/conf.d/
nginx -t && nginx -s reload
curl -I https://your-site.com/ | grep -i strict-transport
```

### Scenario 2: Kubernetes, No Service Mesh Yet
**Use: Nginx Ingress Controller**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/configuration-snippet: |
      add_header Content-Security-Policy "..." always;
      add_header Strict-Transport-Security "..." always;
```

### Scenario 3: Kubernetes + Need mTLS (Phase 2)
**Use: Istio**
```bash
kubectl apply -f infrastructure/gateway/istio-security-config.yaml
istioctl analyze -n valuecanvas
```

---

## Resources

- **Nginx Docs:** https://nginx.org/en/docs/http/ngx_http_headers_module.html
- **Envoy Docs:** https://www.envoyproxy.io/docs
- **Istio Docs:** https://istio.io/latest/docs/
- **Security Headers:** https://securityheaders.com
- **CSP Evaluator:** https://csp-evaluator.withgoogle.com
- **SSL Labs:** https://www.ssllabs.com/ssltest/

---

## Summary

**You NEED security headers at the gateway level!** Choose based on your infrastructure:

| Infrastructure | Best Choice | Why |
|----------------|-------------|-----|
| VMs, simple apps | Nginx | Simple, proven |
| Cloud-native | Envoy | Modern, flexible |
| Kubernetes | Istio | Full service mesh + mTLS |

All configuration files are ready to use in `infrastructure/gateway/`.
