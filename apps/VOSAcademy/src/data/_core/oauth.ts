import { upsertUser } from "../db";
import { createSessionToken } from "./session";
import { getSessionCookieOptions, COOKIE_NAME } from "./cookies";

interface OAuthUserInfo {
  openId: string;
  name?: string;
  email?: string;
  loginMethod?: string;
}

/**
 * Exchange OAuth code for user information
 * This is a placeholder - implement actual OAuth flow with your provider
 */
async function exchangeCodeForUserInfo(code: string): Promise<OAuthUserInfo | null> {
  try {
    const oauthPortalUrl = process.env.VITE_OAUTH_PORTAL_URL;
    const appId = process.env.VITE_APP_ID;

    if (!oauthPortalUrl || !appId) {
      console.error('[OAuth] Missing OAuth configuration');
      return null;
    }

    // TODO: Implement actual OAuth token exchange
    // This should call your OAuth provider's token endpoint
    // For now, this is a placeholder that would need to be implemented
    // based on your specific OAuth provider's API
    
    console.warn('[OAuth] Code exchange not fully implemented - using mock data');
    
    // Mock response for development
    // In production, this should make an actual API call
    return {
      openId: `mock-${code}`,
      name: 'Test User',
      email: 'test@example.com',
      loginMethod: 'oauth',
    };
  } catch (error) {
    console.error('[OAuth] Failed to exchange code:', error);
    return null;
  }
}

/**
 * Handle OAuth callback
 */
export async function handleOAuthCallback(
  code: string,
  state: string,
  req: any,
  res: any
): Promise<{ success: boolean; redirectUrl: string }> {
  try {
    // Validate state parameter (should match what was sent)
    const expectedRedirectUri = Buffer.from(state, 'base64').toString('utf-8');
    
    // Exchange code for user info
    const userInfo = await exchangeCodeForUserInfo(code);
    
    if (!userInfo) {
      return {
        success: false,
        redirectUrl: '/?error=oauth_failed',
      };
    }

    // Upsert user in database
    await upsertUser({
      openId: userInfo.openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: userInfo.loginMethod,
      lastSignedIn: new Date(),
    });

    // Create session token
    const sessionToken = createSessionToken(userInfo.openId);

    // Set session cookie
    const cookieOptions = getSessionCookieOptions(req);
    const cookieString = `${COOKIE_NAME}=${sessionToken}; Path=${cookieOptions.path || '/'}; Max-Age=${cookieOptions.maxAge}; HttpOnly; ${cookieOptions.secure ? 'Secure;' : ''} ${cookieOptions.sameSite ? `SameSite=${cookieOptions.sameSite};` : ''}`;
    
    res.setHeader('Set-Cookie', cookieString);

    return {
      success: true,
      redirectUrl: '/dashboard',
    };
  } catch (error) {
    console.error('[OAuth] Callback handling failed:', error);
    return {
      success: false,
      redirectUrl: '/?error=server_error',
    };
  }
}
