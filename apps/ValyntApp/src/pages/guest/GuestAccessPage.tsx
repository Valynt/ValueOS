/**
 * GuestAccessPage
 *
 * Landing page for guest access via magic link.
 * Validates token and fetches real value case data from the API.
 */

import { AlertCircle, Clock, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { apiClient } from '@/api/client/unified-api-client';
import { getGuestAccessService, GuestPermissions } from '@/GuestAccessService';

import { GuestValueCalculator } from './GuestValueCalculator';

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
  valueDrivers: Array<{
    id: string;
    name: string;
    description: string;
    baseImpact: number;
    confidence: number;
    adjustable: boolean;
  }>;
  assumptions: Array<{
    id: string;
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    description: string;
    impactMultiplier: number;
  }>;
  metrics: {
    npv: number;
    roi: number;
    paybackMonths: number;
    timeHorizon: string;
  };
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
          message: 'No access token provided. Please use the link you received.',
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
    if (!handoffToken) return;
    void validateToken(handoffToken);
  }, [handoffToken]);

  async function validateToken(token: string) {
    try {
      const validation = await guestAccessService.validateToken(token);

      if (!validation.isValid) {
        if (validation.errorMessage?.toLowerCase().includes('expired')) {
          setAccessState({ status: 'expired', message: 'This access link has expired. Please request a new one.' });
          return;
        }
        setAccessState({ status: 'invalid', message: validation.errorMessage || 'Invalid access token format.' });
        return;
      }

      if (!validation.valueCaseId || !validation.permissions || !validation.guestName) {
        setAccessState({ status: 'error', message: 'Missing access details. Please request a new link.' });
        return;
      }

      if (validation.expiresAt && new Date(validation.expiresAt) < new Date()) {
        setAccessState({ status: 'expired', message: 'This access link has expired. Please request a new one.' });
        return;
      }

      // Fetch real value case data using the guest token
      const caseRes = await apiClient.get<ValueCaseData>(
        `/api/v1/guest/cases/${validation.valueCaseId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!caseRes.success || !caseRes.data) {
        setAccessState({ status: 'error', message: caseRes.error?.message || 'Failed to load value case data.' });
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

      setAccessState({ status: 'valid', token: validatedToken, valueCase: caseRes.data });
    } catch {
      setAccessState({ status: 'error', message: 'Failed to validate access. Please try again.' });
    }
  }

  if (accessState.status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Validating access...</h2>
          <p className="text-sm text-muted-foreground mt-1">Please wait while we verify your link</p>
        </div>
      </div>
    );
  }

  if (accessState.status === 'invalid' || accessState.status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-xl shadow-lg p-8 text-center border border-border">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">{accessState.message}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  if (accessState.status === 'expired') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-xl shadow-lg p-8 text-center border border-border">
          <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-warning" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Link Expired</h2>
          <p className="text-muted-foreground mb-6">{accessState.message}</p>
          <button
            onClick={() => { window.location.href = 'mailto:support@valueos.com?subject=Request%20New%20Access%20Link'; }}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Request New Link
          </button>
        </div>
      </div>
    );
  }

  const { token, valueCase } = accessState;

  return (
    <GuestValueCalculator
      companyName={valueCase.companyName}
      title={valueCase.title}
      valueDrivers={valueCase.valueDrivers}
      assumptions={valueCase.assumptions}
      baseMetrics={valueCase.metrics}
      guestName={token.guestName}
      expiresAt={token.expiresAt}
      canEdit={token.permissions.can_edit}
    />
  );
}

export default GuestAccessPage;
