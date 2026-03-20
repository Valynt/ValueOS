import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { csrfProtection } from '../csrfProtection';

describe('CSRFProtection', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};

    // Mock sessionStorage
    const sessionStorageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
      length: 0,
      key: vi.fn(),
    };

    vi.stubGlobal('sessionStorage', sessionStorageMock);

    // Mock document and Forms
    const createElementMock = vi.fn((tagName: string) => {
      if (tagName === 'input') {
        return {
          type: '',
          name: '',
          value: '',
        } as any;
      }
      return {} as any;
    });

    const documentMock = {
      querySelectorAll: vi.fn(() => []),
      createElement: createElementMock,
    };

    vi.stubGlobal('document', documentMock);

    // Mock console.error
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Clear internal state of csrfProtection instance if possible (by clearing token)
    csrfProtection.clearToken();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getToken', () => {
    it('should generate a new 32-character token if one does not exist', () => {
      const token = csrfProtection.getToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(32);
      expect(sessionStorage.setItem).toHaveBeenCalledWith('csrf_token', token);
    });

    it('should return the existing token from sessionStorage if it exists', () => {
      mockStorage['csrf_token'] = 'existing-token-1234567890123456';

      const token = csrfProtection.getToken();

      expect(token).toBe('existing-token-1234567890123456');
      expect(sessionStorage.getItem).toHaveBeenCalledWith('csrf_token');
      // setItem should not be called since we already have a token
      expect(sessionStorage.setItem).not.toHaveBeenCalled();
    });

    it('should fallback to generating a new token if sessionStorage throws an error', () => {
      vi.mocked(sessionStorage.getItem).mockImplementationOnce(() => {
        throw new Error('Storage access denied');
      });

      const token = csrfProtection.getToken();

      expect(console.error).toHaveBeenCalledWith('Failed to get CSRF token');
      expect(token).toBeDefined();
      expect(token.length).toBe(32);
    });
  });

  describe('clearToken', () => {
    it('should remove the token from sessionStorage', () => {
      mockStorage['csrf_token'] = 'token-to-be-removed';

      csrfProtection.clearToken();

      expect(sessionStorage.removeItem).toHaveBeenCalledWith('csrf_token');
      expect(mockStorage['csrf_token']).toBeUndefined();
    });

    it('should handle errors when clearing sessionStorage gracefully', () => {
      vi.mocked(sessionStorage.removeItem).mockImplementationOnce(() => {
        throw new Error('Storage access denied');
      });

      expect(() => csrfProtection.clearToken()).not.toThrow();
      expect(console.error).toHaveBeenCalledWith('Failed to clear CSRF token');
    });
  });

  describe('addTokenToRequest', () => {
    it('should add the CSRF token to the request headers', () => {
      const token = csrfProtection.getToken();
      const options: RequestInit = {
        method: 'POST',
      };

      const newOptions = csrfProtection.addTokenToRequest(options);

      expect(newOptions.headers).toBeInstanceOf(Headers);
      expect((newOptions.headers as Headers).get('X-CSRF-Token')).toBe(token);
      expect(newOptions.method).toBe('POST');
    });

    it('should preserve existing headers when adding the CSRF token', () => {
      const token = csrfProtection.getToken();
      const existingHeaders = new Headers({
        'Content-Type': 'application/json',
      });
      const options: RequestInit = {
        headers: existingHeaders,
      };

      const newOptions = csrfProtection.addTokenToRequest(options);

      expect((newOptions.headers as Headers).get('Content-Type')).toBe('application/json');
      expect((newOptions.headers as Headers).get('X-CSRF-Token')).toBe(token);
    });
  });

  describe('validateToken', () => {
    it('should return true if the token in headers matches the stored token', () => {
      const token = csrfProtection.getToken();
      const headers = new Headers({
        'X-CSRF-Token': token,
      });

      expect(csrfProtection.validateToken(headers)).toBe(true);
    });

    it('should return false if the token in headers does not match the stored token', () => {
      csrfProtection.getToken(); // Ensure a token is generated
      const headers = new Headers({
        'X-CSRF-Token': 'invalid-token',
      });

      expect(csrfProtection.validateToken(headers)).toBe(false);
    });

    it('should return false if the token is missing from headers', () => {
      csrfProtection.getToken();
      const headers = new Headers();

      expect(csrfProtection.validateToken(headers)).toBe(false);
    });
  });

  describe('createSecureForm', () => {
    it('should create a FormData object with the provided data and CSRF token', () => {
      const token = csrfProtection.getToken();
      const data = {
        username: 'testuser',
        action: 'delete',
      };

      const formData = csrfProtection.createSecureForm(data);

      expect(formData).toBeInstanceOf(FormData);
      expect(formData.get('csrf_token')).toBe(token);
      expect(formData.get('username')).toBe('testuser');
      expect(formData.get('action')).toBe('delete');
    });
  });

  describe('validateFormData', () => {
    it('should return true if FormData contains the valid CSRF token', () => {
      const token = csrfProtection.getToken();
      const formData = new FormData();
      formData.append('csrf_token', token);

      expect(csrfProtection.validateFormData(formData)).toBe(true);
    });

    it('should return false if FormData contains an invalid CSRF token', () => {
      csrfProtection.getToken();
      const formData = new FormData();
      formData.append('csrf_token', 'invalid-token');

      expect(csrfProtection.validateFormData(formData)).toBe(false);
    });

    it('should return false if FormData does not contain a CSRF token', () => {
      csrfProtection.getToken();
      const formData = new FormData();

      expect(csrfProtection.validateFormData(formData)).toBe(false);
    });
  });

  describe('getMetaTagHTML', () => {
    it('should return a valid HTML meta tag string containing the CSRF token', () => {
      const token = csrfProtection.getToken();
      const metaTag = csrfProtection.getMetaTagHTML();

      expect(metaTag).toBe(`<meta name="csrf-token" content="${token}">`);
    });
  });

  describe('initialize', () => {
    it('should generate a token if one does not exist', () => {
      csrfProtection.initialize();
      expect(sessionStorage.setItem).toHaveBeenCalledWith('csrf_token', expect.any(String));
    });

    it('should append CSRF token hidden input to existing forms on the page', () => {
      const form1 = {
        querySelector: vi.fn(() => null),
        appendChild: vi.fn(),
      } as any;

      const form2 = {
        querySelector: vi.fn(() => ({})), // Simulate form already having the input
        appendChild: vi.fn(),
      } as any;

      vi.mocked(document.querySelectorAll).mockReturnValue([form1, form2] as any);

      csrfProtection.initialize();

      const token = csrfProtection.getToken();

      // form1 didn't have the input, so querySelector should be called
      expect(form1.querySelector).toHaveBeenCalledWith('input[name="csrf_token"]');

      // document.createElement should have been called for form1
      expect(document.createElement).toHaveBeenCalledWith('input');

      // The created input should have been appended to form1
      expect(form1.appendChild).toHaveBeenCalled();

      // The appended input should have the correct properties
      const appendedInput = form1.appendChild.mock.calls[0][0];
      expect(appendedInput.type).toBe('hidden');
      expect(appendedInput.name).toBe('csrf_token');
      expect(appendedInput.value).toBe(token);

      // form2 already had the input, so appendChild should NOT be called
      expect(form2.appendChild).not.toHaveBeenCalled();
    });
  });

  describe('secureFetch', () => {
    it('should call fetch with the CSRF token added to headers', async () => {
      const token = csrfProtection.getToken();

      const mockFetchResponse = new Response('ok');
      const fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse);
      vi.stubGlobal('fetch', fetchSpy);

      const url = 'https://api.example.com/data';
      const init: RequestInit = {
        method: 'POST',
        body: JSON.stringify({ key: 'value' }),
      };

      const response = await csrfProtection.secureFetch(url, init);

      expect(response).toBe(mockFetchResponse);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const fetchArgs = fetchSpy.mock.calls[0];
      expect(fetchArgs[0]).toBe(url);

      const fetchInit = fetchArgs[1];
      expect(fetchInit.method).toBe('POST');
      expect(fetchInit.body).toBe(JSON.stringify({ key: 'value' }));
      expect(fetchInit.headers).toBeInstanceOf(Headers);
      expect((fetchInit.headers as Headers).get('X-CSRF-Token')).toBe(token);
    });

    it('should handle calling secureFetch without init options', async () => {
      const token = csrfProtection.getToken();

      const mockFetchResponse = new Response('ok');
      const fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse);
      vi.stubGlobal('fetch', fetchSpy);

      const url = 'https://api.example.com/data';

      const response = await csrfProtection.secureFetch(url);

      expect(response).toBe(mockFetchResponse);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const fetchArgs = fetchSpy.mock.calls[0];
      expect(fetchArgs[0]).toBe(url);

      const fetchInit = fetchArgs[1];
      expect(fetchInit.headers).toBeInstanceOf(Headers);
      expect((fetchInit.headers as Headers).get('X-CSRF-Token')).toBe(token);
    });
  });
});
