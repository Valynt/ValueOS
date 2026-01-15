/**
 * Referral Service for Frontend
 * Handles API calls for referral functionality
 */

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  created_at: string;
  is_active: boolean;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referee_id?: string;
  referral_code_id: string;
  status: 'pending' | 'claimed' | 'completed' | 'expired';
  created_at: string;
  claimed_at?: string;
  completed_at?: string;
  referee_email?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface ReferralReward {
  id: string;
  referral_id: string;
  user_id: string;
  reward_type: 'referrer_bonus' | 'referee_discount';
  reward_value: string;
  status: 'earned' | 'claimed' | 'expired';
  created_at: string;
  claimed_at?: string;
  expires_at: string;
}

export interface ReferralStats {
  user_id: string;
  code: string;
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  claimed_referrals: number;
  earned_rewards: number;
}

export interface ReferralDashboard {
  referral_code: ReferralCode;
  stats: ReferralStats;
  recent_referrals: Referral[];
  rewards: ReferralReward[];
}

class ReferralAPI {
  private baseURL = '/api/referrals';

  async generateReferralCode(): Promise<{ success: boolean; referral_code?: ReferralCode; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/generate`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to generate referral code' };
      }

      const data = await response.json();
      return { success: true, referral_code: data.referral_code };
    } catch (error) {
      return { success: false, error: 'Network error occurred' };
    }
  }

  async claimReferral(referralCode: string, email: string): Promise<{ success: boolean; referral_id?: string; reward?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_code: referralCode.toUpperCase(),
          referee_email: email
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to claim referral' };
      }

      const data = await response.json();
      return {
        success: true,
        referral_id: data.referral_id,
        reward: data.reward
      };
    } catch (error) {
      return { success: false, error: 'Network error occurred' };
    }
  }

  async validateReferralCode(code: string): Promise<{ success: boolean; valid: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase() })
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, valid: false, error: error.error || 'Validation failed' };
      }

      const data = await response.json();
      return { success: true, valid: data.valid };
    } catch (error) {
      return { success: false, valid: false, error: 'Network error occurred' };
    }
  }

  async getReferralDashboard(): Promise<{ success: boolean; dashboard?: ReferralDashboard; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/dashboard`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to fetch referral dashboard' };
      }

      const data = await response.json();
      return { success: true, dashboard: data.dashboard };
    } catch (error) {
      return { success: false, error: 'Network error occurred' };
    }
  }

  async getReferralStats(): Promise<{ success: boolean; stats?: ReferralStats; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/stats`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to fetch referral stats' };
      }

      const data = await response.json();
      return { success: true, stats: data.stats };
    } catch (error) {
      return { success: false, error: 'Network error occurred' };
    }
  }

  async getReferralRewards(limit = 10): Promise<{ success: boolean; rewards?: ReferralReward[]; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/rewards?limit=${limit}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to fetch referral rewards' };
      }

      const data = await response.json();
      return { success: true, rewards: data.rewards };
    } catch (error) {
      return { success: false, error: 'Network error occurred' };
    }
  }

  async getReferrals(limit = 10): Promise<{ success: boolean; referrals?: Referral[]; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/referrals?limit=${limit}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to fetch referrals' };
      }

      const data = await response.json();
      return { success: true, referrals: data.referrals };
    } catch (error) {
      return { success: false, error: 'Network error occurred' };
    }
  }

  async completeReferral(referralId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ referral_id: referralId })
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to complete referral' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Network error occurred' };
    }
  }

  async deactivateReferralCode(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/deactivate`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to deactivate referral code' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Network error occurred' };
    }
  }
}

export const referralAPI = new ReferralAPI();
