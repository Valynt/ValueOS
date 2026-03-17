/**
 * Referral Dashboard Component
 * Displays user's referral stats, code, and recent activity
 */

import { Copy, Gift, Share2, TrendingUp, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';


import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

import { apiClient } from '@/api/client/unified-api-client';


interface ReferralStats {
  user_id: string;
  code: string;
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  claimed_referrals: number;
  earned_rewards: number;
}

interface Referral {
  id: string;
  status: 'pending' | 'claimed' | 'completed' | 'expired';
  referee_email?: string;
  created_at: string;
  claimed_at?: string;
  completed_at?: string;
}

interface ReferralReward {
  id: string;
  reward_type: 'referrer_bonus' | 'referee_discount';
  reward_value: string;
  status: 'earned' | 'claimed' | 'expired';
  created_at: string;
  expires_at: string;
}

interface ReferralDashboard {
  referral_code: {
    id: string;
    code: string;
    created_at: string;
    is_active: boolean;
  };
  stats: ReferralStats;
  recent_referrals: Referral[];
  rewards: ReferralReward[];
}

export const ReferralDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferralDashboard();
  }, []);

  const fetchReferralDashboard = async () => {
    try {
      const res = await apiClient.get<{ dashboard: ReferralDashboard }>('/api/referrals/dashboard');
      setDashboard(res.data?.dashboard ?? null);
    } catch (error) {
      console.error('Error fetching referral dashboard:', error);
      toast.error('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = async () => {
    if (!dashboard?.referral_code.code) return;

    try {
      await navigator.clipboard.writeText(dashboard.referral_code.code);
      setCopied(true);
      toast.success('Referral code copied to clipboard!');

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy code');
    }
  };

  const shareReferralLink = async () => {
    if (!dashboard?.referral_code.code) return;

    const referralUrl = `${window.location.origin}?ref=${dashboard.referral_code.code}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join ValueOS',
          text: `I've been using ValueOS and thought you'd love it! Sign up with my referral code ${dashboard.referral_code.code} to get 20% off your first month.`,
          url: referralUrl
        });
      } else {
        await navigator.clipboard.writeText(referralUrl);
        toast.success('Referral link copied to clipboard!');
      }
    } catch (error) {
      toast.error('Failed to share referral');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'claimed': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Start Referring</h3>
            <p className="text-gray-600 mb-4">Generate your referral code to start earning rewards!</p>
            <Button onClick={fetchReferralDashboard}>Generate Referral Code</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const completionRate = dashboard.stats.total_referrals > 0
    ? Math.round((dashboard.stats.completed_referrals / dashboard.stats.total_referrals) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Referrals</p>
                <p className="text-2xl font-bold">{dashboard.stats.total_referrals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold">{dashboard.stats.completed_referrals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Gift className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Rewards Earned</p>
                <p className="text-2xl font-bold">{dashboard.stats.earned_rewards}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="h-5 w-5 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="text-xs font-bold text-orange-600">{completionRate}%</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Completion Rate</p>
                <p className="text-sm font-semibold">{completionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral Code Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Share2 className="h-5 w-5" />
            <span>Your Referral Code</span>
          </CardTitle>
          <CardDescription>
            Share this code with friends to earn rewards when they sign up
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <span className="text-2xl font-mono font-bold text-blue-600">
                  {dashboard.referral_code.code}
                </span>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={copyReferralCode}
                className="flex items-center space-x-2"
              >
                <Copy className="h-4 w-4" />
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </Button>
              <Button onClick={shareReferralLink} className="flex items-center space-x-2">
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </Button>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Share your code or referral link with friends</li>
              <li>• They get 20% off their first month subscription</li>
              <li>• You get 1 month free when they become a paying customer</li>
              <li>• No limits on how many friends you can refer!</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Referrals */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Referrals</CardTitle>
            <CardDescription>Track the status of your referrals</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.recent_referrals.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No referrals yet</p>
                <p className="text-sm text-gray-500">Start sharing your code to see referrals here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboard.recent_referrals.map((referral) => (
                  <div key={referral.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{referral.referee_email || 'Anonymous'}</p>
                      <p className="text-sm text-gray-500">
                        Referred {formatDate(referral.created_at)}
                      </p>
                    </div>
                    <Badge className={getStatusColor(referral.status)}>
                      {referral.status.charAt(0).toUpperCase() + referral.status.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rewards */}
        <Card>
          <CardHeader>
            <CardTitle>Your Rewards</CardTitle>
            <CardDescription>View your earned and available rewards</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.rewards.length === 0 ? (
              <div className="text-center py-8">
                <Gift className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No rewards yet</p>
                <p className="text-sm text-gray-500">Complete referrals to earn rewards</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboard.rewards.map((reward) => (
                  <div key={reward.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium capitalize">
                        {reward.reward_type.replace('_', ' ')}
                      </p>
                      <p className="text-sm text-gray-500">
                        Earned {formatDate(reward.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">{reward.reward_value}</p>
                      <Badge className={getStatusColor(reward.status)}>
                        {reward.status.charAt(0).toUpperCase() + reward.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
