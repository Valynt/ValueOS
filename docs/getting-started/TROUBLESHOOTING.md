# Agent Fabric Troubleshooting Guide

## Issue: "Nothing happens when I try chatting with the agent"

### Root Cause
The Agent Fabric requires an LLM API key to function. Without it, the system cannot process requests.

### Solution

**Step 1: Add API Key**

Open the `.env` file and add your Together.ai API key:

```bash
VITE_TOGETHER_API_KEY=your-api-key-here
```

Get your key from: https://api.together.xyz/settings/api-keys

**Step 2: Restart Dev Server**

After adding the key, restart your development server:

```bash
# Stop the server (Ctrl+C)
# Start it again
npm run dev
```

**Step 3: Test the Agent**

1. Open the app in your browser
2. Press `⌘K` (or `Ctrl+K`)
3. Type a query like: "Create a value case for a SaaS company with 100 employees"
4. Press Enter

You should see a streaming indicator showing "Processing your request..."

---

## Common Error Messages

### ⚠️ "LLM API key not configured"

**What it means**: No API key found in environment variables

**Fix**:
1. Check `.env` file exists in project root
2. Verify `VITE_TOGETHER_API_KEY` is set
3. Make sure there are no quotes around the key value
4. Restart dev server after adding

---

### ❌ "LLM API error: 401 Unauthorized"

**What it means**: API key is invalid or expired

**Fix**:
1. Log in to https://api.together.xyz/settings/api-keys
2. Generate a new API key
3. Replace the old key in `.env`
4. Restart dev server

---

### ❌ "LLM API error: 429 Too Many Requests"

**What it means**: You've hit rate limits

**Fix**:
1. Wait a few minutes before retrying
2. Check your Together.ai account usage
3. Consider upgrading your plan if you're on free tier

---

### ❌ "AgentFabric not initialized"

**What it means**: The fabric initialization was skipped

**Fix**:
- This should auto-initialize on first use
- If it persists, check browser console for underlying errors
- Ensure Supabase connection is working (check `.env` for VITE_SUPABASE_URL)

---

## Debugging Steps

### 1. Check Environment Variables

```bash
# In project root
cat .env
```

Should show:
```
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_TOGETHER_API_KEY=your-key-here
```

### 2. Check Browser Console

Open Developer Tools → Console

Look for:
- ✅ "Agent Fabric initialized"
- ❌ Any red error messages

### 3. Check Network Tab

Open Developer Tools → Network

When you submit a query, you should see:
- Request to `https://api.together.xyz/v1/chat/completions`
- Status: 200 OK
- Response with model output

### 4. Test API Key Directly

```bash
curl https://api.together.xyz/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Should return a list of available models.

---

## Using OpenAI Instead

If you prefer OpenAI over Together.ai:

1. Remove or comment out Together.ai key:
```bash
# VITE_TOGETHER_API_KEY=
```

2. Add OpenAI key:
```bash
VITE_OPENAI_API_KEY=sk-...
```

3. Restart server

The system will automatically detect and use OpenAI as fallback.

---

## Performance Issues

### Agent is slow to respond

**Possible causes**:
- Large context (many components on canvas)
- Complex query requiring multiple agents
- Network latency to Together.ai

**Solutions**:
1. Use a faster model:
   - Try `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` (smaller, faster)
   - Edit `LLMGateway.ts` and change `defaultModel`

2. Reduce context:
   - Clear canvas before making new requests
   - Keep queries specific and concise

3. Check network:
   - Open DevTools → Network tab
   - Look for slow requests to Together.ai API

---

## Database Issues

### "Permission denied" errors

**Fix**: Ensure you're using authenticated Supabase client

The app uses Row Level Security (RLS). All operations are scoped to user sessions.

### Can't see past value cases

**Fix**:
1. Check `agent_sessions` table - sessions should be created
2. Verify `value_cases` table has data
3. Check RLS policies are active

Query Supabase directly:
```sql
SELECT * FROM agent_sessions ORDER BY started_at DESC LIMIT 10;
SELECT * FROM value_cases ORDER BY created_at DESC LIMIT 10;
```

---

## Still Having Issues?

### Check System Status

1. **Supabase**: https://status.supabase.com
2. **Together.ai**: https://status.together.ai

### Enable Verbose Logging

Add to your component:

```typescript
console.log('Agent Fabric initialized:', fabric);
console.log('LLM Provider:', llmGateway.getProvider());
console.log('Default Model:', llmGateway.getDefaultModel());
```

### Test Components Individually

```typescript
// Test LLM Gateway directly
const gateway = new LLMGateway(apiKey, 'together');
const response = await gateway.complete([
  { role: 'user', content: 'Say hello' }
]);
console.log(response);
```

---

## Contact & Support

If none of these solutions work:

1. Check the browser console for detailed error messages
2. Review the `AGENT_FABRIC_README.md` for setup instructions
3. Ensure all dependencies are installed: `npm install`
4. Try a fresh build: `rm -rf dist && npm run build`

The app should now display clear error messages in the UI when something goes wrong, including specific instructions for fixing API key issues.
