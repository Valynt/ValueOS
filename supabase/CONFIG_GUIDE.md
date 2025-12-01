# Supabase Configuration Guide

## 📋 config.toml Overview

The `config.toml` file configures your local Supabase development environment.

## 🔧 Key Settings to Customize

### **1. Project ID**
```toml
project_id = "valuecanvas"
```
- Used to distinguish projects on the same host
- Keep this unique per project

---

### **2. Database Version**
```toml
[db]
major_version = 15
```
- **IMPORTANT:** Must match your remote database version
- Check remote version: `SHOW server_version;`
- ValueCanvas uses: Postgres 15

---

### **3. Authentication**
```toml
[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = ["https://localhost:3000"]
enable_signup = true
```

**For Production:**
- Change `site_url` to your production domain
- Add production URLs to `additional_redirect_urls`

---

### **4. OAuth Providers**

To enable OAuth (GitHub, Google, etc.):

```toml
[auth.external.github]
enabled = true
client_id = "your_github_client_id"
secret = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET)"
redirect_uri = "http://localhost:54321/auth/v1/callback"
```

**Steps:**
1. Create OAuth app in provider dashboard
2. Set `enabled = true`
3. Add `client_id`
4. Store `secret` in `.env.local`:
   ```bash
   SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=your_secret
   ```

---

### **5. Email Settings**
```toml
[auth.email]
enable_signup = true
enable_confirmations = false  # Set true for prod!
```

**For Production:**
- Set `enable_confirmations = true`
- Configure SMTP (see Supabase dashboard)

---

### **6. Storage Limits**
```toml
[storage]
file_size_limit = "50MiB"
```

Adjust based on your needs:
- Documents: `10MiB`
- Images: `5MiB`
- Videos: `100MiB`

---

### **7. API Settings**
```toml
[api]
max_rows = 1000
```

**For production APIs:**
- Increase if you need to return more rows
- Add pagination instead of raising limit

---

## 🔒 Environment Variables

**Never commit secrets to git!** Use environment variables:

Create `.env.local`:
```bash
# OAuth Secrets
SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=xxx
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=xxx

# SMS (Twilio)
SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN=xxx

# Other services
STRIPE_SECRET_KEY=xxx
OPENAI_API_KEY=xxx
```

Reference in config.toml:
```toml
secret = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET)"
```

---

## 🚀 Testing Configuration

```bash
# Start Supabase with config
supabase start

# Verify services are running
supabase status

# Check specific service
curl http://localhost:54321/rest/v1/

# View Studio
open http://localhost:54323
```

---

## 📊 Port Reference

| Service | Port | Description |
|---------|------|-------------|
| API | 54321 | REST/GraphQL API |
| Database | 54322 | Direct Postgres connection |
| Studio | 54323 | Web dashboard |
| Inbucket | 54324 | Email testing UI |
| Realtime | 54321 | WebSocket connections |

---

## 🔄 Common Customizations

### **Enable Connection Pooler**
For high-traffic applications:
```toml
[db.pooler]
enabled = true
pool_mode = "transaction"
default_pool_size = 20
```

### **Increase JWT Expiry**
For longer sessions:
```toml
[auth]
jwt_expiry = 7200  # 2 hours
```

### **Disable Studio** (Production)
```toml
[studio]
enabled = false
```

### **Enable Analytics**
```toml
[analytics]
enabled = true
backend = "postgres"
```

---

## 🐛 Troubleshooting

### **Port Already in Use**
```bash
# Find process using port
lsof -i :54321

# Kill process
kill -9 <PID>

# Or change port in config.toml
```

### **Database Connection Failed**
1. Check `supabase status`
2. Verify `major_version` matches
3. Try `supabase stop` then `supabase start`

### **Auth Not Working**
1. Check `site_url` matches your frontend
2. Verify redirect URLs are correct
3. Check OAuth credentials are set

---

## 📚 Additional Resources

- **Supabase Docs:** https://supabase.com/docs
- **Config Reference:** https://supabase.com/docs/guides/cli/config
- **Local Development:** https://supabase.com/docs/guides/cli/local-development

---

**Last Updated:** December 1, 2025  
**Config Version:** Supabase CLI v1.x
