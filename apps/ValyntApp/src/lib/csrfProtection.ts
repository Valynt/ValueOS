/**
 * CSRF Protection Utility
 * Generates and validates CSRF tokens for state-changing operations
 */

/**
 * Constant-time string comparison to prevent timing attacks.
 * Always iterates over max(a.length, b.length) characters.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let result = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}

class CSRFProtection {
  private readonly tokenKey = "csrf_token";
  private readonly tokenHeader = "X-CSRF-Token";
  private readonly tokenLength = 32;

  /**
   * Generate a cryptographically random token using Web Crypto API.
   */
  private generateToken(): string {
    const array = new Uint8Array(this.tokenLength);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Get or generate CSRF token
   */
  getToken(): string {
    try {
      let token = sessionStorage.getItem(this.tokenKey);

      if (!token) {
        token = this.generateToken();
        sessionStorage.setItem(this.tokenKey, token);
      }

      return token;
    } catch (error) {
      console.error("Failed to get CSRF token");
      return this.generateToken(); // Fallback
    }
  }

  /**
   * Clear CSRF token
   */
  clearToken(): void {
    try {
      sessionStorage.removeItem(this.tokenKey);
    } catch (error) {
      console.error("Failed to clear CSRF token");
    }
  }

  /**
   * Add CSRF token to fetch options
   */
  addTokenToRequest(options: RequestInit): RequestInit {
    const token = this.getToken();

    const headers = new Headers(options.headers);
    headers.set(this.tokenHeader, token);

    return {
      ...options,
      headers,
    };
  }

  /**
   * Validate CSRF token from request headers using constant-time comparison
   * to prevent timing-based token guessing attacks.
   */
  validateToken(requestHeaders: Headers): boolean {
    const token = requestHeaders.get(this.tokenHeader);
    if (!token) return false;
    const storedToken = this.getToken();
    return constantTimeEqual(token, storedToken);
  }

  /**
   * Create a secure form with CSRF token
   */
  createSecureForm(formData: Record<string, string>): FormData {
    const form = new FormData();

    // Add CSRF token
    form.append("csrf_token", this.getToken());

    // Add other form data
    Object.entries(formData).forEach(([key, value]) => {
      form.append(key, value);
    });

    return form;
  }

  /**
   * Validate form data contains valid CSRF token using constant-time comparison.
   */
  validateFormData(formData: FormData): boolean {
    const token = formData.get("csrf_token") as string | null;
    if (!token) return false;
    const storedToken = this.getToken();
    return constantTimeEqual(token, storedToken);
  }

  /**
   * Get CSRF token for meta tag (for SPA frameworks)
   */
  getMetaTagHTML(): string {
    const token = this.getToken();
    return `<meta name="csrf-token" content="${token}">`;
  }

  /**
   * Initialize CSRF protection for the page
   */
  initialize(): void {
    // Generate token if not exists
    this.getToken();

    // Add token to all forms dynamically
    if (typeof document !== "undefined") {
      this.addTokensToExistingForms();
    }
  }

  /**
   * Add CSRF tokens to existing forms on the page
   */
  private addTokensToExistingForms(): void {
    const forms = document.querySelectorAll("form");
    const token = this.getToken();

    forms.forEach((form) => {
      // Check if form already has CSRF token
      if (!form.querySelector('input[name="csrf_token"]')) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "csrf_token";
        input.value = token;
        form.appendChild(input);
      }
    });
  }

  /**
   * Wrap fetch with CSRF protection
   */
  secureFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const secureInit = init ? this.addTokenToRequest(init) : this.addTokenToRequest({});

     
    // eslint-disable-next-line no-restricted-globals
    return fetch(input, secureInit);
  };
}

// Export singleton instance
export const csrfProtection = new CSRFProtection();
