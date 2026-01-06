/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocsViewer } from './DocsViewer';
import { DocSection } from './types';
import React from 'react';

const mockNavigate = vi.fn();

const xssSection: DocSection = {
  id: 'xss',
  title: 'XSS Test',
  category: 'overview',
  path: '/xss',
  version: '1.0',
  lastUpdated: new Date().toISOString(),
  content: '[Click me](javascript:alert("XSS"))'
};

const filterBypassSection: DocSection = {
  id: 'bypass',
  title: 'Filter Bypass',
  category: 'developer-guide',
  path: '/bypass',
  version: '1.0',
  lastUpdated: new Date().toISOString(),
  content: '~~~~js\nconsole.log("Secret Code");\n~~~~'
};

describe('DocsViewer Chaos Security Tests', () => {
  it('should prevent XSS in links', () => {
    // Phase 1: Vulnerability Assessment - XSS
    render(<DocsViewer section={xssSection} userRole="developer" onNavigate={mockNavigate} />);
    
    // We expect the link to be either BLOCKED or Sanitized.
    const blocked = screen.queryByText(/BLOCKED UNSAFE LINK/i);
    
    if (!blocked) {
       // If not explicitly blocked by our code, ensure no dangerous link exists
       const links = screen.queryAllByRole('link');
       // eslint-disable-next-line no-script-url
       const dangerousLink = links.find(l => l.getAttribute('href')?.toLowerCase().includes('javascript:'));
       expect(dangerousLink).toBeUndefined();
    }
  });

  it('should filter tilde code blocks for business users', () => {
    // Phase 1: Vulnerability Assessment - Content Filtering Bypass
    // "business" role should NOT see code blocks.
    render(<DocsViewer section={filterBypassSection} userRole="business" onNavigate={mockNavigate} />);
    
    // If vulnerable, "Secret Code" is visible.
    const secretCode = screen.queryByText('Secret Code');
    
    // If this fails, the filter was bypassed
    expect(secretCode).not.toBeInTheDocument();
    
    // Expect the replacement text
    expect(screen.getByText(/Technical details available/)).toBeInTheDocument();
  });
});
