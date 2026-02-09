/**
 * Referral Program Types
 * Core types for the referral system
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
export interface GenerateReferralCodeRequest {
    user_id: string;
}
export interface GenerateReferralCodeResponse {
    success: boolean;
    referral_code?: ReferralCode;
    error?: string;
}
export interface ClaimReferralRequest {
    referral_code: string;
    referee_email: string;
    ip_address?: string;
    user_agent?: string;
}
export interface ClaimReferralResponse {
    success: boolean;
    referral_id?: string;
    referrer_id?: string;
    reward?: string;
    error?: string;
}
export interface ReferralDashboard {
    referral_code: ReferralCode;
    stats: ReferralStats;
    recent_referrals: Referral[];
    rewards: ReferralReward[];
}
//# sourceMappingURL=referral.d.ts.map