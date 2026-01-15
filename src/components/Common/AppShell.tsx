/**
 * AppShell - Immediate render container
 * 
 * Renders immediately with a startup status screen, then hydrates
 * the full application. Ensures the user never sees a blank screen.
 */

import React, { useState, useEffect, useCallback, ReactNode } from 'react';

// Dependency status types
export type DependencyStatus = 'pending' | 'checking' | 'ok' | 'degraded' | 'error';

export interface DependencyCheck {
  name: string;
  status: DependencyStatus;
  required: boolean;
  message?: string;
  lastError?: string;
  endpoint?: string;
}

export interface StartupState {
  phase: 'initializing' | 'checking' | 'ready' | 'degraded' | 'error';
  dependencies: DependencyCheck[];
  startTime: number;
  readyTime?: number;
  errors: string[];
}

// Check configuration with timeouts
const DEPENDENCY_CHECKS: Array<{
  name: string;
  required: boolean;
  check: () => Promise<{ ok: boolean; message?: string; endpoint?: string }>;
  timeout: number;
}> = [
  {
    name: 'Configuration',
    required: true,
    timeout: 1000,
    check: async () => {
      // Check for invalid browser URLs (container-only hostnames)
      // Note: localhost URLs are OK when running through Vite dev server (proxy handles them)
      // Only block Docker service names that can't be resolved in browser
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      
      // These are Docker service names that only work inside Docker network
      const containerOnlyPatterns = [
        /^https?:\/\/backend:/,
        /^https?:\/\/supabase:/,
        /^https?:\/\/postgres:/,
        /^https?:\/\/redis:/,
        /^https?:\/\/db:/,
        /^https?:\/\/api:/,
      ];
      
      // Check if we're in a remote environment (Gitpod/Codespaces)
      const isRemoteEnv = window.location.hostname.includes('gitpod') || 
                          window.location.hostname.includes('github.dev') ||
                          window.location.hostname.includes('codespaces');
      
      for (const pattern of containerOnlyPatterns) {
        if (pattern.test(apiUrl)) {
          return {
            ok: false,
            message: `API URL "${apiUrl}" uses Docker service name. Re-run env compiler for local/remote mode.`,
            endpoint: apiUrl,
          };
        }
        if (pattern.test(supabaseUrl)) {
          return {
            ok: false,
            message: `Supabase URL "${supabaseUrl}" uses Docker service name.`,
            endpoint: supabaseUrl,
          };
        }
      }
      
      // Warn (but don't block) if using localhost in remote environment
      // The Vite proxy should handle this, but it's worth noting
      if (isRemoteEnv && (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1'))) {
        // Don't block - Vite proxy handles localhost URLs
        // Just return OK with a note
        return { 
          ok: true, 
          message: 'Using localhost URLs via Vite proxy' 
        };
      }
      
      return { ok: true, message: 'Environment configured correctly' };
    },
  },
  {
    name: 'Backend API',
    required: false, // UI can render without backend
    timeout: 3000,
    check: async () => {
      // Always use relative URL - Vite proxy handles routing to backend
      // This works in all environments: localhost, Gitpod, Codespaces
      try {
        const response = await fetch('/api/health', {
          method: 'GET',
          signal: AbortSignal.timeout(2500),
        });
        
        if (response.ok) {
          return { ok: true, message: 'Backend healthy', endpoint: '/api/health (proxied)' };
        }
        return { ok: false, message: `Backend returned ${response.status}`, endpoint: '/api/health' };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'Connection failed',
          endpoint: '/api/health',
        };
      }
    },
  },
  {
    name: 'Supabase',
    required: false, // UI can render without Supabase (auth will be unavailable)
    timeout: 5000,
    check: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        return { ok: false, message: 'Supabase not configured' };
      }
      
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
          signal: AbortSignal.timeout(4500),
        });
        
        if (response.ok || response.status === 200) {
          return { ok: true, message: 'Supabase connected', endpoint: supabaseUrl };
        }
        return { ok: false, message: `Supabase returned ${response.status}`, endpoint: supabaseUrl };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'Connection failed',
          endpoint: supabaseUrl,
        };
      }
    },
  },
];

// Startup Status Display Component
function StartupStatus({ state, onRetry }: { state: StartupState; onRetry: () => void }) {
  const elapsed = state.readyTime 
    ? state.readyTime - state.startTime 
    : Date.now() - state.startTime;
  
  const getStatusIcon = (status: DependencyStatus) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'checking': return '🔄';
      case 'ok': return '✅';
      case 'degraded': return '⚠️';
      case 'error': return '❌';
    }
  };
  
  const getStatusColor = (status: DependencyStatus) => {
    switch (status) {
      case 'pending': return '#6B7280';
      case 'checking': return '#3B82F6';
      case 'ok': return '#10B981';
      case 'degraded': return '#F59E0B';
      case 'error': return '#EF4444';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0F172A',
      color: '#E2E8F0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        padding: '2rem',
      }}>
        {/* Logo/Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#60A5FA' }}>
            VALYNT
          </div>
          <div style={{ fontSize: '0.875rem', color: '#94A3B8', marginTop: '0.5rem' }}>
            {state.phase === 'initializing' && 'Starting up...'}
            {state.phase === 'checking' && 'Checking dependencies...'}
            {state.phase === 'ready' && 'Ready'}
            {state.phase === 'degraded' && 'Running in degraded mode'}
            {state.phase === 'error' && 'Startup failed'}
          </div>
        </div>

        {/* Dependency Status List */}
        <div style={{
          backgroundColor: '#1E293B',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          {state.dependencies.map((dep) => (
            <div
              key={dep.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 0',
                borderBottom: '1px solid #334155',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }}>{getStatusIcon(dep.status)}</span>
                <div>
                  <div style={{ fontWeight: 500 }}>
                    {dep.name}
                    {!dep.required && (
                      <span style={{ 
                        fontSize: '0.75rem', 
                        color: '#64748B',
                        marginLeft: '0.5rem',
                      }}>
                        (optional)
                      </span>
                    )}
                  </div>
                  {dep.message && (
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: getStatusColor(dep.status),
                      marginTop: '0.25rem',
                    }}>
                      {dep.message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Timing */}
        <div style={{ 
          textAlign: 'center', 
          fontSize: '0.75rem', 
          color: '#64748B',
          marginBottom: '1rem',
        }}>
          {elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`}
        </div>

        {/* Error Details */}
        {state.errors.length > 0 && (
          <div style={{
            backgroundColor: '#7F1D1D',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
          }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Errors:</div>
            {state.errors.map((error, i) => (
              <div key={i} style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                • {error}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {(state.phase === 'degraded' || state.phase === 'error') && (
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={onRetry}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Retry Checks
            </button>
            {state.phase === 'degraded' && (
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: '#94A3B8',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Continue Anyway
              </button>
            )}
          </div>
        )}

        {/* Guidance for Gitpod users */}
        {state.phase === 'error' && state.errors.some(e => e.includes('localhost') || e.includes('container')) && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: '#1E3A5F',
            borderRadius: '8px',
            fontSize: '0.875rem',
          }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>💡 Gitpod/Codespaces Tip:</div>
            <div style={{ color: '#94A3B8' }}>
              If you're in a cloud development environment, localhost URLs won't work.
              Run <code style={{ backgroundColor: '#0F172A', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                npm run dx:env -- --mode=remote
              </code> to configure for remote access.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main AppShell Component
export function AppShell({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StartupState>({
    phase: 'initializing',
    dependencies: DEPENDENCY_CHECKS.map(c => ({
      name: c.name,
      status: 'pending',
      required: c.required,
    })),
    startTime: Date.now(),
    errors: [],
  });
  
  const [showApp, setShowApp] = useState(false);

  const runChecks = useCallback(async () => {
    setState(prev => ({
      ...prev,
      phase: 'checking',
      errors: [],
      dependencies: prev.dependencies.map(d => ({ ...d, status: 'checking' as DependencyStatus })),
    }));

    const results: DependencyCheck[] = [];
    const errors: string[] = [];
    let hasRequiredFailure = false;

    for (const check of DEPENDENCY_CHECKS) {
      try {
        // Run check with timeout
        const result = await Promise.race([
          check.check(),
          new Promise<{ ok: false; message: string }>((resolve) =>
            setTimeout(() => resolve({ ok: false, message: 'Timeout' }), check.timeout)
          ),
        ]);

        const depResult: DependencyCheck = {
          name: check.name,
          status: result.ok ? 'ok' : (check.required ? 'error' : 'degraded'),
          required: check.required,
          message: result.message,
          endpoint: result.endpoint,
        };

        if (!result.ok && check.required) {
          hasRequiredFailure = true;
          errors.push(`${check.name}: ${result.message}`);
        }

        results.push(depResult);
      } catch (error) {
        const depResult: DependencyCheck = {
          name: check.name,
          status: check.required ? 'error' : 'degraded',
          required: check.required,
          message: error instanceof Error ? error.message : 'Unknown error',
          lastError: error instanceof Error ? error.message : undefined,
        };

        if (check.required) {
          hasRequiredFailure = true;
          errors.push(`${check.name}: ${depResult.message}`);
        }

        results.push(depResult);
      }

      // Update state after each check for progressive feedback
      setState(prev => ({
        ...prev,
        dependencies: [
          ...results,
          ...prev.dependencies.slice(results.length),
        ],
      }));
    }

    // Determine final phase
    const hasDegraded = results.some(r => r.status === 'degraded');
    const phase = hasRequiredFailure ? 'error' : (hasDegraded ? 'degraded' : 'ready');

    setState(prev => ({
      ...prev,
      phase,
      dependencies: results,
      readyTime: Date.now(),
      errors,
    }));

    // Show app if no required failures
    if (!hasRequiredFailure) {
      // Small delay to show the "ready" state
      setTimeout(() => setShowApp(true), phase === 'ready' ? 300 : 0);
    }
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  // Show startup status until ready
  if (!showApp) {
    return <StartupStatus state={state} onRetry={runChecks} />;
  }

  // Render the app with optional degraded mode banner
  return (
    <>
      {state.phase === 'degraded' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#F59E0B',
          color: '#1F2937',
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          textAlign: 'center',
          zIndex: 9999,
        }}>
          ⚠️ Running in degraded mode. Some features may be unavailable.
          {state.dependencies.filter(d => d.status === 'degraded').map(d => (
            <span key={d.name} style={{ marginLeft: '0.5rem' }}>
              {d.name}: {d.message}
            </span>
          ))}
        </div>
      )}
      {children}
    </>
  );
}

export default AppShell;
