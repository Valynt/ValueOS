# OAuth Social Login Configuration Guide

This guide explains how to configure Google, Apple, and GitHub OAuth providers for the VALYNT authentication system.

## Prerequisites

- Access to your Supabase project dashboard
- Admin credentials for each OAuth provider you want to enable

## Supabase Configuration

### 1. Access Provider Settings

1. Navigate to your Supabase project dashboard
2. Go to **Authentication** → **Providers**
3. Find the provider you want to configure

### 2. Configure Redirect URLs

For each provider, you'll need to add authorized redirect URLs:

**Development:**

```
http://localhost:5173/auth/callback
```

**Production:**

```
https://yourdomain.com/auth/callback
```

---

## Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**

### Step 2: Configure OAuth Consent Screen

1. Click **OAuth consent screen**
2. Select **External** user type
3. Fill in required fields:
   - App name: **VALYNT**
   - User support email
   - Developer contact information
4. Add scopes: `email`, `profile`, `openid`
5. Save and continue

### Step 3: Create OAuth Client ID

1. Click **Create Credentials** → **OAuth client ID**
2. Application type: **Web application**
3. Name: **VALYNT Web Client**
4. Add Authorized redirect URIs:
   - `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

### Step 4: Configure in Supabase

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **Google**
3. Paste **Client ID** and **Client Secret**
4. Save changes

---

## Apple Sign In Setup

> [!WARNING]
> Apple Sign In requires an Apple Developer account ($99/year)

### Step 1: Create App ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** button
4. Select **App IDs** → Continue
5. Select **App** → Continue
6. Configure:
   - Description: **VALYNT**
   - Bundle ID: `com.valynt.app`
   - Enable **Sign In with Apple**
7. Click **Continue** → **Register**

### Step 2: Create Service ID

1. Click **Identifiers** → **+** button
2. Select **Services IDs** → Continue
3. Configure:
   - Description: **VALYNT Web Service**
   - Identifier: `com.valynt.service`
   - Enable **Sign In with Apple**
4. Click **Configure** next to Sign In with Apple
5. Add domains and return URLs:
   - Primary App ID: Select your App ID
   - Domains: `[YOUR-PROJECT-REF].supabase.co`
   - Return URLs: `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`
6. Save → Continue → Register

### Step 3: Create Private Key

1. Go to **Keys** → **+** button
2. Key Name: **VALYNT Sign In Key**
3. Enable **Sign In with Apple**
4. Click **Configure** → Select your App ID
5. Save → Continue → Register
6. **Download the key file** (you can only download once!)
7. Note the **Key ID**

### Step 4: Configure in Supabase

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **Apple**
3. Enter:
   - **Services ID**: `com.valynt.service`
   - **Team ID**: Found in Apple Developer account
   - **Key ID**: From step 3
   - **Private Key**: Contents of downloaded .p8 file
4. Save changes

---

## GitHub OAuth Setup

### Step 1: Create OAuth App

1. Go to [GitHub Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in details:
   - Application name: **VALYNT**
   - Homepage URL: `https://valynt.xyz`
   - Authorization callback URL: `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`
4. Click **Register application**

### Step 2: Generate Client Secret

1. Click **Generate a new client secret**
2. Copy the **Client ID** and **Client Secret**

### Step 3: Configure in Supabase

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **GitHub**
3. Paste **Client ID** and **Client Secret**
4. Save changes

---

## Testing

### Local Development

1. Ensure your `.env.local` contains:

   ```env
   VITE_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

2. Start dev server: `npm run dev`

3. Navigate to login page and click a social login button

4. You should be redirected to the provider's consent screen

### Troubleshooting

**Error: "Invalid redirect URI"**

- Verify redirect URLs match exactly in both provider and Supabase
- Check for trailing slashes or protocol mismatches

**Error: "Provider not configured"**

- Ensure provider is enabled in Supabase dashboard
- Verify credentials are correctly entered

**Error: "OAuth flow failed"**

- Check browser console for detailed error messages
- Verify callback URL is accessible
- Ensure provider credentials are valid

**Apple Sign In not working:**

- Verify Service ID domain configuration
- Check that private key is correctly formatted
- Ensure Team ID and Key ID are correct

---

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate secrets regularly** (every 90 days recommended)
4. **Monitor OAuth logs** in Supabase dashboard
5. **Limit OAuth scopes** to only what's necessary
6. **Enable MFA** for admin accounts on all platforms

---

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
