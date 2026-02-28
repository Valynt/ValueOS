import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Analytics } from '../Analytics';

describe('Analytics Component', () => {
  beforeEach(() => {
    // Clear DOM before each test
    document.head.innerHTML = '';
    document.body.innerHTML = '';

    // Mock VITE_GTM_CONTAINER_ID
    vi.stubEnv('VITE_GTM_CONTAINER_ID', 'GTM-TEST1234');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    // Clean up window properties
    if ((window as any).dataLayer) {
      delete (window as any).dataLayer;
    }
  });

  it('should inject GTM script into head', () => {
    render(<Analytics />);

    const script = document.querySelector('script[src^="https://www.googletagmanager.com/gtm.js"]');
    expect(script).toBeTruthy();
    expect(script?.getAttribute('src')).toContain('id=GTM-TEST1234');
  });

  it('should inject GTM noscript iframe into body', () => {
    render(<Analytics />);

    const noscript = document.querySelector('noscript');
    expect(noscript).toBeTruthy();

    const iframe = noscript?.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('src')).toContain('id=GTM-TEST1234');
    expect(iframe?.getAttribute('height')).toBe('0');
    expect(iframe?.getAttribute('width')).toBe('0');
    expect(iframe?.style.display).toBe('none');
    expect(iframe?.style.visibility).toBe('hidden');
  });

  it('should not inject anything if GTM ID is missing', () => {
    vi.stubEnv('VITE_GTM_CONTAINER_ID', '');

    render(<Analytics />);

    const script = document.querySelector('script[src^="https://www.googletagmanager.com/gtm.js"]');
    expect(script).toBeNull();

    const noscript = document.querySelector('noscript');
    expect(noscript).toBeNull();
  });

  it('should initialize dataLayer', () => {
     render(<Analytics />);

     expect((window as any).dataLayer).toBeDefined();
     expect(Array.isArray((window as any).dataLayer)).toBe(true);
     // Check if gtm.start event was pushed
     expect((window as any).dataLayer.some((e: any) => e.event === 'gtm.js')).toBe(true);
  });
});
