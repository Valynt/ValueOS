/**
 * Referral Claim Component
 * Handles claiming referral codes during signup
 */

import { AlertCircle, CheckCircle, Gift } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';


interface ReferralClaimProps {
  onReferralClaimed?: (referralData: any) => void;
  defaultEmail?: string;
}

export const ReferralClaim: React.FC<ReferralClaimProps> = ({
  onReferralClaimed,
  defaultEmail = ''
}) => {
  const [referralCode, setReferralCode] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimedReferral, setClaimedReferral] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<boolean | null>(null);

  const validateReferralCode = async (code: string) => {
    if (code.length !== 8) {
      setValidationResult(null);
      return;
    }

    setIsValidating(true);
    try {
      const response = await fetch('/api/referrals/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase() })
      });

      const data = await response.json();
      setValidationResult(data.valid);
    } catch (error) {
      setValidationResult(false);
    } finally {
      setIsValidating(false);
    }
  };

  const handleReferralCodeChange = (value: string) => {
    const formattedCode = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setReferralCode(formattedCode);
    setValidationResult(null);

    if (formattedCode.length === 8) {
      validateReferralCode(formattedCode);
    }
  };

  const handleClaimReferral = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!referralCode || !email) {
      toast.error('Please fill in all fields');
      return;
    }

    if (referralCode.length !== 8) {
      toast.error('Referral code must be 8 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/referrals/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_code: referralCode.toUpperCase(),
          referee_email: email
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to claim referral');
      }

      setClaimedReferral(data);
      toast.success(data.message || 'Referral claimed successfully!');

      if (onReferralClaimed) {
        onReferralClaimed(data);
      }

    } catch (error) {
      console.error('Error claiming referral:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to claim referral');
    } finally {
      setIsSubmitting(false);
    }
  };

  const skipReferral = () => {
    if (onReferralClaimed) {
      onReferralClaimed(null);
    }
  };

  if (claimedReferral) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6">
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-green-900 mb-2">
              Referral Claimed Successfully!
            </h3>
            <p className="text-green-800 mb-4">
              You've earned a {claimedReferral.reward} discount on your first month!
            </p>
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600">Referral ID</p>
              <p className="font-mono text-sm">{claimedReferral.referral_id}</p>
            </div>
            <Button onClick={skipReferral} className="bg-green-600 hover:bg-green-700">
              Continue to Signup
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Gift className="h-5 w-5" />
          <span>Have a Referral Code?</span>
        </CardTitle>
        <CardDescription>
          Enter a referral code to get 20% off your first month
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleClaimReferral} className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <Label htmlFor="referralCode">Referral Code</Label>
            <div className="relative">
              <Input
                id="referralCode"
                type="text"
                value={referralCode}
                onChange={(e) => handleReferralCodeChange(e.target.value)}
                placeholder="Enter 8-character code"
                maxLength={8}
                className="font-mono uppercase"
                required
              />
              {isValidating && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              )}
              {validationResult !== null && !isValidating && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {validationResult ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              )}
            </div>

            {validationResult === true && (
              <p className="text-sm text-green-600 mt-1">
                Valid referral code! You'll get 20% off your first month.
              </p>
            )}

            {validationResult === false && (
              <p className="text-sm text-red-600 mt-1">
                Invalid or inactive referral code.
              </p>
            )}
          </div>

          <div className="flex space-x-3">
            <Button
              type="submit"
              disabled={isSubmitting || validationResult === false}
              className="flex-1"
            >
              {isSubmitting ? 'Claiming...' : 'Claim Referral'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={skipReferral}
              className="flex-1"
            >
              Skip for Now
            </Button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">How referrals work:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Enter your friend's referral code above</li>
            <li>• Get 20% off your first month subscription</li>
            <li>• Your friend gets 1 month free when you subscribe</li>
            <li>• Win-win for everyone!</li>
          </ul>
        </div>

        <div className="mt-4">
          <Badge variant="secondary" className="text-xs">
            No credit card required to claim referral
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
