-- Referral Program Schema for ValueOS
-- Enables user-to-user referral tracking and rewards

-- Extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Referral codes table - unique codes for each user
CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,

    -- Constraints
    CONSTRAINT referral_codes_user_id_unique UNIQUE(user_id),
    CONSTRAINT referral_codes_code_format CHECK (code ~ '^[A-Z0-9]{8}$')
);

-- Referrals table - tracks referral relationships
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    claimed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    referee_email TEXT,
    ip_address INET,
    user_agent TEXT,

    -- Constraints
    CONSTRAINT referrals_status_check CHECK (status IN ('pending', 'claimed', 'completed', 'expired')),
    CONSTRAINT referrals_no_self_referral CHECK (referrer_id != referee_id)
);

-- Referral rewards table - tracks earned rewards
CREATE TABLE IF NOT EXISTS referral_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reward_type TEXT NOT NULL,
    reward_value TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'earned',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    claimed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT referral_rewards_type_check CHECK (reward_type IN ('referrer_bonus', 'referee_discount')),
    CONSTRAINT referral_rewards_status_check CHECK (status IN ('earned', 'claimed', 'expired'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee_id ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user_id ON referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status ON referral_rewards(status);

-- Row Level Security (RLS) Policies
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- Users can only see their own referral codes
CREATE POLICY "Users can view own referral codes" ON referral_codes
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own referral codes
CREATE POLICY "Users can create own referral codes" ON referral_codes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own referral codes (deactivate)
CREATE POLICY "Users can update own referral codes" ON referral_codes
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can see referrals they are involved in (as referrer or referee)
CREATE POLICY "Users can view involved referrals" ON referrals
    FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

-- Users can create referrals (will be verified by backend)
CREATE POLICY "Users can create referrals" ON referrals
    FOR INSERT WITH CHECK (auth.uid() = referrer_id);

-- Users can see their own rewards
CREATE POLICY "Users can view own rewards" ON referral_rewards
    FOR SELECT USING (auth.uid() = user_id);

-- Functions for referral management

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        new_code := upper(substring(encode(gen_random_bytes(4), 'hex'), 1, 8));
        SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = new_code) INTO code_exists;

        IF NOT code_exists THEN
            EXIT;
        END IF;
    END LOOP;

    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to create referral code for user
CREATE OR REPLACE FUNCTION create_user_referral_code(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    new_referral_code_id UUID;
    new_code TEXT;
BEGIN
    -- Check if user already has a referral code
    SELECT id INTO new_referral_code_id FROM referral_codes WHERE user_id = p_user_id AND is_active = true;

    IF new_referral_code_id IS NOT NULL THEN
        RETURN new_referral_code_id;
    END IF;

    -- Generate new code
    new_code := generate_referral_code();

    -- Insert new referral code
    INSERT INTO referral_codes (user_id, code)
    VALUES (p_user_id, new_code)
    RETURNING id INTO new_referral_code_id;

    RETURN new_referral_code_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process referral claim
CREATE OR REPLACE FUNCTION process_referral_claim(p_referral_code TEXT, p_referee_email TEXT, p_ip_address INET DEFAULT NULL, p_user_agent TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    referral_code_record RECORD;
    new_referral_id UUID;
    reward_result JSON;
BEGIN
    -- Find valid referral code
    SELECT rc.id, rc.user_id as referrer_id INTO referral_code_record
    FROM referral_codes rc
    WHERE rc.code = p_referral_code AND rc.is_active = true;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or inactive referral code');
    END IF;

    -- Check if email already used this referral code
    IF EXISTS(SELECT 1 FROM referrals WHERE referral_code_id = referral_code_record.id AND referee_email = p_referee_email) THEN
        RETURN json_build_object('success', false, 'error', 'This email has already used this referral code');
    END IF;

    -- Create referral record
    INSERT INTO referrals (referrer_id, referral_code_id, referee_email, ip_address, user_agent, status)
    VALUES (referral_code_record.referrer_id, referral_code_record.id, p_referee_email, p_ip_address, p_user_agent, 'claimed')
    RETURNING id INTO new_referral_id;

    -- Create referee reward (20% discount)
    INSERT INTO referral_rewards (referral_id, user_id, reward_type, reward_value, status, expires_at)
    VALUES (
        new_referral_id,
        referral_code_record.referrer_id,
        'referee_discount',
        '20%',
        'earned',
        NOW() + INTERVAL '30 days'
    );

    RETURN json_build_object(
        'success', true,
        'referral_id', new_referral_id,
        'referrer_id', referral_code_record.referrer_id,
        'reward', '20% discount on first month'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to complete referral (when referee converts)
CREATE OR REPLACE FUNCTION complete_referral(p_referral_id UUID, p_referee_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    referral_record RECORD;
BEGIN
    -- Get referral details
    SELECT id, referrer_id INTO referral_record
    FROM referrals
    WHERE id = p_referral_id AND status = 'claimed';

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Update referral status
    UPDATE referrals
    SET status = 'completed', referee_id = p_referee_id, completed_at = NOW()
    WHERE id = p_referral_id;

    -- Create referrer reward (1 month free)
    INSERT INTO referral_rewards (referral_id, user_id, reward_type, reward_value, status, expires_at)
    VALUES (
        p_referral_id,
        referral_record.referrer_id,
        'referrer_bonus',
        '1_month_free',
        'earned',
        NOW() + INTERVAL '90 days'
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic processes

-- Trigger to create referral code when user signs up
CREATE OR REPLACE FUNCTION auto_create_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_user_referral_code(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger should be created manually after setting up auth.users table monitoring
-- CREATE TRIGGER on_user_signup_create_referral_code
--     AFTER INSERT ON auth.users
--     FOR EACH ROW
--     EXECUTE FUNCTION auto_create_referral_code();

-- Views for analytics

CREATE OR REPLACE VIEW referral_stats AS
SELECT
    rc.user_id,
    rc.code,
    COUNT(r.id) as total_referrals,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_referrals,
    COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_referrals,
    COUNT(CASE WHEN r.status = 'claimed' THEN 1 END) as claimed_referrals,
    COALESCE(SUM(CASE WHEN rr.reward_type = 'referrer_bonus' AND rr.status = 'earned' THEN 1 END), 0) as earned_rewards
FROM referral_codes rc
LEFT JOIN referrals r ON rc.id = r.referral_code_id
LEFT JOIN referral_rewards rr ON r.id = rr.referral_id AND rr.reward_type = 'referrer_bonus'
WHERE rc.is_active = true
GROUP BY rc.user_id, rc.code, rc.id;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON referral_codes TO authenticated;
GRANT ALL ON referrals TO authenticated;
GRANT ALL ON referral_rewards TO authenticated;
GRANT SELECT ON referral_stats TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION generate_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_referral_code(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_referral_claim(TEXT, TEXT, INET, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_referral(UUID, UUID) TO authenticated;
