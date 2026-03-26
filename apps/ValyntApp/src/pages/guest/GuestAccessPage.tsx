/**
 * GuestAccessPage
 * 
 * Landing page for guest access via magic link.
 * Validates token and renders the appropriate view.
 */

import { AlertCircle, Clock, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { GuestValueCalculator } from './GuestValueCalculator';

import { getGuestAccessService, GuestPermissions } from '@/GuestAccessService';

// Guest access token structure (matches GuestAccessService)
interface GuestAccessToken {
  id: string;
  valueCaseId: string;
  guestEmail: string;
  guestName: string;
  permissions: GuestPermissions;
  expiresAt: string;
  createdAt: string;
}

interface ValueCaseData {
  id: string;
  companyName: string;
  title: string;
}

type AccessState = 
  | { status: 'loading' }
  | { status: 'valid'; token: GuestAccessToken; valueCase: ValueCaseData }
  | { status: 'expired'; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'error'; message: string };

export function GuestAccessPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [handoffToken, setHandoffToken] = useState<string | null>(null);
  const [accessState, setAccessState] = useState<AccessState>({ status: 'loading' });
  const guestAccessService = getGuestAccessService();

  const fragmentToken = useMemo(() => {
    const fragment = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    return fragment ? new URLSearchParams(fragment).get('token') : null;
  }, [location.hash]);

  useEffect(() => {
    const incomingToken = fragmentToken ?? searchParams.get('token');

    if (!incomingToken) {
      if (!handoffToken) {
        setAccessState({ 
          status: 'invalid', 
          message: 'No access token provided. Please use the link you received.' 
        });
      }
      return;
    }

    setHandoffToken(incomingToken);

    if (fragmentToken || searchParams.get('token')) {
      navigate(location.pathname, { replace: true });
    }
  }, [fragmentToken, handoffToken, location.pathname, navigate, searchParams]);

  useEffect(() => {
    if (!handoffToken) {
      return;
    }

    void validateToken(handoffToken);
  }, [handoffToken]);

  async function validateToken(token: string) {
    try {
      const validation = await guestAccessService.validateToken(token);

      if (!validation.isValid) {
        if (validation.errorMessage?.toLowerCase().includes('expired')) {
          setAccessState({
            status: 'expired',
            message: 'This access link has expired. Please request a new one.',
          });
          return;
        }

        setAccessState({
          status: 'invalid',
          message: validation.errorMessage || 'Invalid access token format.',
        });
        return;
      }

      if (!validation.valueCaseId || !validation.permissions || !validation.guestName) {
        setAccessState({
          status: 'error',
          message: 'Missing access details. Please request a new link.',
        });
        return;
      }

      if (validation.expiresAt && new Date(validation.expiresAt) < new Date()) {
        setAccessState({
          status: 'expired',
          message: 'This access link has expired. Please request a new one.',
        });
        return;
      }

      const validatedToken: GuestAccessToken = {
        id: token.slice(0, 12),
        valueCaseId: validation.valueCaseId,
        guestEmail: validation.guestEmail || '',
        guestName: validation.guestName,
        permissions: validation.permissions,
        expiresAt: validation.expiresAt || new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const valueCaseSnapshot = await guestAccessService.getGuestValueCaseSnapshot(validation.valueCaseId);
      if (!valueCaseSnapshot) {
        setAccessState({
          status: 'error',
          message: 'This value case is no longer available.',
        });
        return;
      }

      const valueCase: ValueCaseData = {
        id: valueCaseSnapshot.id,
        companyName: valueCaseSnapshot.companyName,
        title: valueCaseSnapshot.name,
      };

      setAccessState({
        status: 'valid',
        token: validatedToken,
        valueCase,
      });

    } catch (error) {
      setAccessState({ 
        status: 'error', 
        message: 'Failed to validate access. Please try again.' 
      });
    }
  }

  // Loading state
  if (accessState.status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700">Validating access...</h2>
          <p className="text-sm text-slate-500 mt-1">Please wait while we verify your link</p>
        </div>
      </div>
    );
  }

  // Error states
  if (accessState.status === 'invalid' || accessState.status === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600 mb-6">{accessState.message}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  // Expired state
  if (accessState.status === 'expired') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Link Expired</h2>
          <p className="text-slate-600 mb-6">{accessState.message}</p>
          <button
            onClick={() => window.location.href = 'mailto:support@valueos.com?subject=Request%20New%20Access%20Link'}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Request New Link
          </button>
        </div>
      </div>
    );
  }

  // Valid access - render calculator
  const { token, valueCase } = accessState;

  return (
    <GuestValueCalculator
      companyName={valueCase.companyName}
      title={valueCase.title}
      guestName={token.guestName}
      expiresAt={token.expiresAt}
      canEdit={token.permissions.can_edit}
    />
  );
}

export default GuestAccessPage;
