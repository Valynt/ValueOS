const TOKEN_KEY = 'vc.csrf.token';

function generateToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getCsrfToken(): string {
  if (typeof window === 'undefined') return '';
  let token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = generateToken();
    sessionStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export function rotateCsrfToken(): string {
  if (typeof window === 'undefined') return '';
  const token = generateToken();
  sessionStorage.setItem(TOKEN_KEY, token);
  return token;
}
