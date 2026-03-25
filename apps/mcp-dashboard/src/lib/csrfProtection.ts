/**
 * CSRF Protection Utility
 * Generates and validates CSRF tokens for state-changing operations
 */

class CSRFProtection {
  private readonly tokenKey = "csrf_token";
  private readonly tokenHeader = "X-CSRF-Token";
  private readonly tokenLength = 32;

  /**
   * Generate a secure random token
   */
  private generateToken(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    // Use cryptographically secure random numbers instead of Math.random()
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const randomValues = new Uint8Array(this.tokenLength);
      crypto.getRandomValues(randomValues);
      for (let i = 0; i < this.tokenLength; i++) {
        token += chars[randomValues[i] % chars.length];
      }
    } else {
      // Fallback for environments without crypto support (should be very rare)
      for (let i = 0; i < this.tokenLength; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return token;
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
   * Validate CSRF token from request headers
   */
  validateToken(requestHeaders: Headers): boolean {
    const token = requestHeaders.get(this.tokenHeader);
    const storedToken = this.getToken();

    return token === storedToken;
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
   * Validate form data contains valid CSRF token
   */
  validateFormData(formData: FormData): boolean {
    const token = formData.get("csrf_token") as string;
    const storedToken = this.getToken();

    return token === storedToken;
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

    return fetch(input, secureInit);
  };
}

// Export singleton instance
export const csrfProtection = new CSRFProtection();
