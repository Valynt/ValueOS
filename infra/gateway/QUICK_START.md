# Gateway Security - Quick Start Guide

## ✅ Yes, You NEED This!

Security headers **must** be configured at your gateway/load balancer/CDN level for:
- Protection before reaching your app
- Defense against zero-day vulnerabilities
- Compliance (OWASP, PCI-DSS, SOC 2)
- Centralized security management

---

## 🚀 Quick Deploy (Choose Your Gateway)

> **Baseline rule:** Pick exactly one gateway per environment (e.g., Nginx for VM-based staging, Istio for Kubernetes production) and keep the documented baseline consistent with the deployed gateway.

### Option 1: Nginx (Most Common)

```bash
# 1. Copy configuration
sudo cp infrastructure/gateway/nginx-security-headers.conf /etc/nginx/conf.d/

# 2. Update your domain in the config
sudo nano /etc/nginx/conf.d/nginx-security-headers.conf
# Replace: valuecanvas.example.com

# 3. Test configuration
sudo nginx -t

# 4. Reload Nginx
sudo nginx -s reload

# 5. Verify
./infrastructure/gateway/verify-security-headers.sh https://your-domain.com
```

**Time: 5 minutes** ⏱️

---

### Option 2: Kubernetes with Istio

```bash
# 1. Update domain in config
nano infrastructure/gateway/istio-security-config.yaml
# Replace: valuecanvas.example.com

# 2. Apply configuration
kubectl apply -f infrastructure/gateway/istio-security-config.yaml

# 3. Verify
kubectl get gateway,virtualservice -n valuecanvas
istioctl analyze -n valuecanvas

# 4. Test headers
./infrastructure/gateway/verify-security-headers.sh https://your-domain.com
```

**Time: 10 minutes** ⏱️

---

### Option 3: Envoy (Standalone)

```bash
# 1. Update config
nano infrastructure/gateway/envoy-security-config.yaml
# Update certificates and backend addresses

# 2. Validate
envoy --config-path infrastructure/gateway/envoy-security-config.yaml --mode validate

# 3. Start Envoy
envoy -c infrastructure/gateway/envoy-security-config.yaml

# 4. Verify
./infrastructure/gateway/verify-security-headers.sh https://your-domain.com
```

**Time: 15 minutes** ⏱️

---

## 🧪 Verification

Run the verification script:

```bash
./infrastructure/gateway/verify-security-headers.sh https://your-site.com
```

**Expected output:**
```
✅ Content-Security-Policy: default-src 'self'; ...
✅ Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
✅ X-Frame-Options: DENY
✅ X-Content-Type-Options: nosniff
✅ Referrer-Policy: strict-origin-when-cross-origin

🎉 Your gateway security configuration is working correctly!
```

---

## 🧭 Baseline + Drift Control (Recommended)

To avoid mismatches between documentation and production gateways:

- **Document the gateway baseline per environment** (e.g., `staging: Nginx`, `production: Istio`).
- **Validate TLS/mTLS settings** with automated scanners (scheduled checks + CI/CD runs) to confirm TLS 1.2+ and mTLS expectations.
- **Track configuration drift in CI** by validating gateway configs (lint/validate commands) and diffing approved security headers/TLS settings.

---

## 🔍 Manual Verification

```bash
# Quick check
curl -I https://your-site.com/ | grep -Ei 'content-security-policy|strict-transport'

# Detailed check
curl -sI https://your-site.com/ | grep -E '^[A-Z].*:' | sort
```

---

## ⚙️ What Each Configuration Includes

All three configurations provide:

### ✅ Security Headers
1. **Content-Security-Policy** - XSS protection
2. **Strict-Transport-Security** - Force HTTPS
3. **X-Frame-Options** - Clickjacking protection
4. **X-Content-Type-Options** - MIME sniffing protection
5. **Referrer-Policy** - Referrer control
6. **X-XSS-Protection** - Legacy browser protection
7. **Permissions-Policy** - Feature restriction

### ✅ Rate Limiting (Phase 1 Requirement)
- Auth endpoints: 5 requests/minute
- API endpoints: 60 requests/minute

### ✅ TLS Configuration
- TLS 1.2+ only
- Strong cipher suites
- HTTP → HTTPS redirect

### ✅ Istio Bonus Features (Phase 2)
- **Automatic mTLS** between services
- Service mesh capabilities
- Built-in observability

---

## 📝 Customization Checklist

Before deploying, update these values:

### All Configurations
- [ ] Replace `valuecanvas.example.com` with your domain
- [ ] Update TLS certificate paths
- [ ] Adjust rate limits if needed
- [ ] Verify backend service addresses

### CSP Customization
If you use additional services, update `connect-src`:

```nginx
# Add your services
connect-src 'self' 
    https://*.supabase.co        # Supabase
    wss://*.supabase.co          # Supabase WebSocket
    https://your-api.com         # Your APIs
    https://analytics.example.com # Analytics
```

### HSTS Consideration
Start with shorter max-age for testing:

```nginx
# Testing (5 minutes)
Strict-Transport-Security: max-age=300

# Production (1 year)
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## 🐛 Troubleshooting

### Headers Not Appearing

**Nginx:**
```bash
# Check if config is loaded
nginx -T | grep add_header

# Check logs
tail -f /var/log/nginx/error.log
```

**Istio:**
```bash
# Check EnvoyFilter
kubectl get envoyfilter security-headers -n valuecanvas -o yaml

# Check gateway logs
kubectl logs -n istio-system -l app=istio-ingressgateway --tail=100
```

### CSP Breaking Your App

1. Check browser console for CSP violations
2. Add missing sources to appropriate directives
3. Test with CSP report-only mode first:

```nginx
# Report-only mode (logs violations without blocking)
add_header Content-Security-Policy-Report-Only "..." always;
```

### Rate Limiting Too Strict

Adjust limits based on legitimate traffic:

```nginx
# Nginx - increase rate
limit_req_zone $binary_remote_addr zone=auth_zone:10m rate=10r/m;  # 10 instead of 5

# Or increase burst
limit_req zone=auth_zone burst=5 nodelay;  # 5 instead of 3
```

---

## 📚 Additional Resources

### Testing Tools
- **SecurityHeaders.com** - https://securityheaders.com
- **SSL Labs** - https://www.ssllabs.com/ssltest
- **CSP Evaluator** - https://csp-evaluator.withgoogle.com

### Documentation
- **Nginx:** https://nginx.org/en/docs
- **Istio:** https://istio.io/latest/docs
- **Envoy:** https://www.envoyproxy.io/docs

### Files Created
```
infrastructure/gateway/
├── nginx-security-headers.conf      ← Nginx config
├── envoy-security-config.yaml       ← Envoy config
├── istio-security-config.yaml       ← Istio config
├── GATEWAY_COMPARISON.md            ← Detailed comparison
├── QUICK_START.md                   ← This file
└── verify-security-headers.sh       ← Verification script
```

---

## 💡 Pro Tips

1. **Start Simple** - Use Nginx if you're unsure
2. **Test First** - Use staging environment before production
3. **Monitor CSP Violations** - They'll tell you what to whitelist
4. **Gradual Rollout** - Start with report-only, then enforce
5. **Document Changes** - Note why you added each CSP source

---

## ✅ Production Checklist

Before going live:

- [ ] Security headers configured at gateway
- [ ] TLS certificates installed and valid
- [ ] Rate limiting tested with load tests
- [ ] CSP tested (no console violations)
- [ ] HSTS max-age set to 1 year (after testing)
- [ ] Verification script passes
- [ ] Monitoring/alerting configured
- [ ] Backup/rollback plan ready

---

## 🎯 Summary

**Quick Answer:** YES, you need gateway-level security headers!

**Recommended:**
- **Simple/VM setup:** Use Nginx config
- **Kubernetes:** Use Istio config (gets you mTLS for Phase 2)
- **Advanced needs:** Use Envoy config

**Deploy time:** 5-15 minutes
**Verification:** Run `./verify-security-headers.sh`

All configurations are **production-ready** and follow **security best practices**.

---

Need help? Check `GATEWAY_COMPARISON.md` for detailed comparison and decision guidance.
